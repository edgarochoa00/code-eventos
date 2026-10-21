/**
 * Sella todos los eventos que ya existen al momento de activar el detector:
 * crea un ancla "sello" por proyecto, sus pares de palabras y el índice compacto por evento.
 *
 *   npx -y tsx@4.23.15 scripts/detector-backfill.ts --dry   → solo cuenta, no escribe
 *   npx -y tsx@4.23.15 scripts/detector-backfill.ts         → escribe en code-94fbe
 *
 * Usa la sesión del Firebase CLI (`firebase login`) con una cuenta dueña del proyecto.
 * Es idempotente: volver a correrlo reescribe el índice y agrega un nuevo sello por proyecto.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { buildSignals } from "@/lib/detector/signals";
import type { DetectorProject, IndexEntry } from "@/lib/detector/types";

const PROJECT = process.env.FIREBASE_PROJECT ?? "code-94fbe";
const DRY = process.argv.includes("--dry");
const INDEX_CHUNK = 150;

function token() {
  try {
    execFileSync("firebase", ["projects:list", "--json"], { stdio: "ignore" });
  } catch {
    execFileSync("npx", ["-y", "firebase-tools@15", "projects:list", "--json"], { stdio: "ignore" });
  }
  const store = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, "utf8"));
  if (!store.tokens?.access_token) throw new Error("Inicia sesión con `firebase login` primero.");
  return store.tokens.access_token as string;
}

const headers = { Authorization: `Bearer ${token()}`, "x-goog-user-project": PROJECT, "Content-Type": "application/json" };
const ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

type FsValue = Record<string, unknown>;

function fromValue(v: FsValue): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) {
    const ms = Date.parse(String(v.timestampValue));
    return { toMillis: () => ms, toDate: () => new Date(ms) };
  }
  if ("arrayValue" in v) return ((v.arrayValue as { values?: FsValue[] }).values ?? []).map(fromValue);
  if ("mapValue" in v) return fromFields((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {});
  return null;
}
const fromFields = (fields: Record<string, FsValue>) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));

function toValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
  return { stringValue: String(v) };
}
const toFields = (data: Record<string, unknown>) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)]));

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 404) throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json as { documents?: { name: string; fields?: Record<string, FsValue> }[]; nextPageToken?: string };
}

async function list(path: string) {
  const out: { id: string; data: Record<string, unknown> }[] = [];
  let page = "";
  do {
    const r = await api("GET", `${ROOT}/${path}?pageSize=300${page ? `&pageToken=${page}` : ""}`);
    for (const d of r.documents ?? []) out.push({ id: d.name.split("/").pop()!, data: fromFields(d.fields ?? {}) });
    page = r.nextPageToken ?? "";
  } while (page);
  return out;
}

const set = (path: string, data: Record<string, unknown>) => api("PATCH", `${ROOT}/${path}`, { fields: toFields(data) });
const remove = (path: string) => api("DELETE", `${ROOT}/${path}`);

async function main() {
  const events = await list("events");
  let sealed = 0;
  for (const ev of events) {
    const projects = await list(`events/${ev.id}/projects`);
    const now = new Date();
    const entries: IndexEntry[] = [];
    for (const p of projects) {
      const project = { id: p.id, ...p.data } as unknown as DetectorProject;
      const s = await buildSignals(project);
      const createdAt = (p.data.createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? now.getTime();
      const { shingles, contentHash: _c, ...rest } = s;
      void _c;
      entries.push({ ...rest, projectId: p.id, eventId: ev.id, year: new Date(createdAt).getFullYear(), firstSeenAt: createdAt });
      if (!DRY) {
        await set(`events/${ev.id}/projects/${p.id}/anchors/backfill-${now.getTime()}`, {
          ...s,
          projectId: p.id,
          eventId: ev.id,
          kind: "sello",
          source: "organizador",
          createdBy: "backfill",
          createdAt: now,
        });
        await set(`originalityShingles/${p.id}`, { projectId: p.id, eventId: ev.id, shingles, sealedAt: now });
      }
    }
    const chunks: IndexEntry[][] = [];
    for (let i = 0; i < entries.length; i += INDEX_CHUNK) chunks.push(entries.slice(i, i + INDEX_CHUNK));
    if (!chunks.length) chunks.push([]);
    const startDate = String(ev.data.startDate ?? "");
    const year = new Date(startDate ? `${startDate}T12:00:00` : now).getFullYear();
    if (!DRY) {
      for (let i = 0; i < chunks.length; i++) {
        await set(`originalityIndex/${i === 0 ? ev.id : `${ev.id}__${i}`}`, {
          eventId: ev.id,
          eventName: String(ev.data.name ?? ""),
          year,
          chunk: i,
          entries: chunks[i],
          sealedBy: "backfill",
          sealedAt: now,
        });
      }
      // Borra fragmentos sobrantes de un índice anterior más grande
      for (let i = chunks.length; i < chunks.length + 20; i++) await remove(`originalityIndex/${ev.id}__${i}`);
    }
    sealed += projects.length;
    console.log(`${DRY ? "[prueba] " : ""}${String(ev.data.name ?? ev.id).padEnd(40)} ${projects.length} proyecto(s), ${chunks.length} fragmento(s)`);
  }
  console.log(`\n${DRY ? "Se sellarían" : "Sellados"} ${sealed} proyecto(s) de ${events.length} evento(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
