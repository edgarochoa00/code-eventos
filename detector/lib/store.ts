/**
 * Lecturas y escrituras del detector en Firestore.
 * Todas las reglas de seguridad correspondientes están en detector/rules/.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentReference,
  type WriteBatch,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import type { EventDoc } from "@/lib/types";
import { normalizeEmail } from "@/lib/utils";
import { caseIdFor, decideAlerts, eventExclusions, findCandidates, shinglesToLoad } from "./detect";
import { DETECTOR_POLICY } from "./policy";
import { buildSignals } from "./signals";
import type {
  Alert,
  AnchorKind,
  CaseDoc,
  CaseOutcome,
  DetectorProject,
  IndexDoc,
  IndexEntry,
  LiveProject,
  ShinglesDoc,
} from "./types";

/* ---------- Referencias ---------- */

export const anchorsCol = (eventId: string, projectId: string) =>
  collection(db, "events", eventId, "projects", projectId, "anchors");
export const casesCol = (eventId: string) => collection(db, "events", eventId, "cases");
export const caseRef = (eventId: string, caseId: string) => doc(db, "events", eventId, "cases", caseId);
export const caseLogCol = (eventId: string, caseId: string) => collection(db, "events", eventId, "cases", caseId, "log");
export const indexCol = () => collection(db, "originalityIndex");
export const shinglesRef = (projectId: string) => doc(db, "originalityShingles", projectId);
const projectDocRef = (eventId: string, projectId: string) => doc(db, "events", eventId, "projects", projectId);

const INDEX_CHUNK = 150;
const BATCH_LIMIT = 400;

/** Primera aparición: createdAt con hora del servidor (las reglas lo obligan al activar). */
export function firstSeenOf(project: DetectorProject) {
  const t = project.createdAt as { toMillis?: () => number } | null;
  return typeof t?.toMillis === "function" ? t.toMillis() : Date.now();
}

function actor(user: User) {
  return { by: user.uid, byEmail: normalizeEmail(user.email ?? ""), at: serverTimestamp() };
}

/** Lotes de escritura que se confirman solos al llenarse. */
function batcher() {
  let batch: WriteBatch = writeBatch(db);
  let n = 0;
  return {
    get batch() {
      return batch;
    },
    async add(count = 1) {
      n += count;
      if (n >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        n = 0;
      }
    },
    async flush() {
      if (n) await batch.commit();
      batch = writeBatch(db);
      n = 0;
    },
  };
}

/* ---------- Anclas (versiones inmutables) ---------- */

/**
 * Guarda una versión del proyecto con hora del servidor. Nunca bloquea al equipo:
 * si falla, se registra en consola y el guardado del proyecto sigue siendo válido.
 */
export async function writeAnchor(
  eventId: string,
  project: DetectorProject,
  kind: AnchorKind,
  user: User,
  source: "equipo" | "organizador" = "equipo",
) {
  try {
    const signals = await buildSignals(project);
    await addDoc(anchorsCol(eventId, project.id), {
      ...signals,
      projectId: project.id,
      eventId,
      kind,
      source,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[detector] No se pudo guardar el ancla", err);
  }
}

/* ---------- Sello del organizador + índice compacto ---------- */

/**
 * Recalcula las huellas desde el contenido real, guarda un ancla "sello" por proyecto
 * y reconstruye el índice del evento. Solo organizadores/admins (lo exigen las reglas).
 */
export async function sealEvent(event: EventDoc, projects: DetectorProject[], user: User) {
  const live = await Promise.all(projects.map(async (p) => ({ p, s: await buildSignals(p) })));
  const b = batcher();

  for (const { p, s } of live) {
    b.batch.set(doc(anchorsCol(event.id, p.id)), {
      ...s,
      projectId: p.id,
      eventId: event.id,
      kind: "sello",
      source: "organizador",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    b.batch.set(shinglesRef(p.id), {
      projectId: p.id,
      eventId: event.id,
      shingles: s.shingles,
      sealedAt: serverTimestamp(),
    } satisfies Omit<ShinglesDoc, "sealedAt"> & { sealedAt: unknown });
    await b.add(2);
  }

  const entries: IndexEntry[] = live.map(({ p, s }) => {
    const { shingles: _s, contentHash: _c, ...rest } = s;
    void _s;
    void _c;
    const firstSeenAt = firstSeenOf(p);
    return { ...rest, projectId: p.id, eventId: event.id, year: new Date(firstSeenAt).getFullYear(), firstSeenAt };
  });
  const chunks: IndexEntry[][] = [];
  for (let i = 0; i < entries.length; i += INDEX_CHUNK) chunks.push(entries.slice(i, i + INDEX_CHUNK));
  if (!chunks.length) chunks.push([]);

  const existing = await getDocs(query(indexCol(), where("eventId", "==", event.id)));
  const year = new Date(event.startDate ? `${event.startDate}T12:00:00` : Date.now()).getFullYear();
  chunks.forEach((list, i) => {
    const id = i === 0 ? event.id : `${event.id}__${i}`;
    b.batch.set(doc(indexCol(), id), {
      eventId: event.id,
      eventName: event.name,
      year,
      chunk: i,
      entries: list,
      sealedBy: user.uid,
      sealedAt: serverTimestamp(),
    });
  });
  await b.add(chunks.length);
  for (const d of existing.docs) {
    const chunk = (d.data() as IndexDoc).chunk ?? 0;
    if (chunk >= chunks.length) {
      b.batch.delete(d.ref);
      await b.add();
    }
  }
  await b.flush();
  return { projects: live.length, chunks: chunks.length };
}

export async function loadIndex(): Promise<IndexEntry[]> {
  const snap = await getDocs(indexCol());
  return snap.docs.flatMap((d) => (d.data() as IndexDoc).entries ?? []);
}

export async function loadShingles(projectIds: string[]) {
  const map = new Map<string, number[]>();
  await Promise.all(
    projectIds.map(async (id) => {
      const snap = await getDoc(shinglesRef(id));
      if (snap.exists()) map.set(id, (snap.data() as ShinglesDoc).shingles ?? []);
    }),
  );
  return map;
}

/* ---------- Detección → casos ---------- */

const OPEN: CaseDoc["status"][] = ["por_revisar", "esperando_equipo", "en_revision"];

function evidenceChanged(prev: CaseDoc, a: Alert) {
  const p = prev.evidence;
  const n = a.evidence;
  return p.level !== n.level || p.files !== n.files || p.links !== n.links || p.phrases.shared !== n.phrases.shared;
}

export async function runDetection(event: EventDoc, projects: DetectorProject[], user: User, existingCases: CaseDoc[]) {
  const live: LiveProject[] = await Promise.all(
    projects.map(async (p) => ({ project: p, signals: await buildSignals(p), firstSeenAt: firstSeenOf(p) })),
  );
  const excluded = eventExclusions([event.name ?? "", event.description ?? ""], live);
  const index = await loadIndex();
  const pairs = findCandidates(live, index, event.id);
  const shingles = await loadShingles(shinglesToLoad(pairs));
  const alerts = decideAlerts(pairs, shingles, excluded);

  const byId = new Map(existingCases.map((c) => [c.id, c]));
  const b = batcher();
  let created = 0;
  let updated = 0;
  for (const a of alerts) {
    const id = caseIdFor(a.projectId, a.other.projectId);
    const prev = byId.get(id);
    if (!prev) {
      const data: Omit<CaseDoc, "id" | "createdAt" | "updatedAt"> = {
        eventId: event.id,
        projectId: a.projectId,
        otherProjectId: a.other.projectId,
        otherEventId: a.other.eventId,
        otherYear: a.other.year,
        firstSeenAt: a.firstSeenAt,
        otherFirstSeenAt: a.other.firstSeenAt,
        evidence: a.evidence,
        matchedShingles: a.matchedShingles,
        status: "por_revisar",
        teamNotified: false,
        teamResponse: null,
        proposal: null,
        decision: null,
        createdBy: user.uid,
      };
      b.batch.set(caseRef(event.id, id), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      b.batch.set(doc(caseLogCol(event.id, id)), {
        ...actor(user),
        action: "detectado",
        note: a.evidence.reasons.join(" "),
      });
      await b.add(2);
      created++;
    } else if (OPEN.includes(prev.status) && evidenceChanged(prev, a)) {
      b.batch.update(caseRef(event.id, id), {
        evidence: a.evidence,
        matchedShingles: a.matchedShingles,
        updatedAt: serverTimestamp(),
      });
      b.batch.set(doc(caseLogCol(event.id, id)), {
        ...actor(user),
        action: "evidencia_actualizada",
        note: a.evidence.reasons.join(" "),
      });
      await b.add(2);
      updated++;
    }
  }
  await b.flush();
  return { analyzed: live.length, compared: index.length, alerts: alerts.length, created, updated };
}

/* ---------- Acciones sobre un caso ---------- */

export type CaseAction =
  | { type: "notificar" }
  | { type: "revisar"; note: string }
  | { type: "descartar"; reason: string }
  | { type: "proponer"; outcome: CaseOutcome; reason: string }
  | { type: "confirmar" }
  | { type: "rechazar"; note: string }
  | { type: "reabrir"; note: string }
  | { type: "responder"; text: string; links: string[] };

export async function applyCaseAction(event: EventDoc, c: CaseDoc, user: User, action: CaseAction) {
  const batch = writeBatch(db);
  const ref = caseRef(event.id, c.id);
  const log = (name: string, note: string) =>
    batch.set(doc(caseLogCol(event.id, c.id)), { ...actor(user), action: name, note: note.trim() });
  const project: DocumentReference = projectDocRef(event.id, c.projectId);
  const now = serverTimestamp();

  switch (action.type) {
    case "notificar":
      batch.update(ref, { status: "esperando_equipo", teamNotified: true, updatedAt: now });
      log("equipo_notificado", "Se pidió al equipo explicar la coincidencia.");
      break;
    case "revisar":
      batch.update(ref, { status: "en_revision", updatedAt: now });
      log("en_revision", action.note);
      break;
    case "descartar":
      batch.update(ref, {
        status: "descartado",
        decision: { ...actor(user), outcome: "sin_efecto", reason: action.reason.trim() },
        updatedAt: now,
      });
      log("descartado", action.reason);
      break;
    case "proponer": {
      const direct = DETECTOR_POLICY.confirmation === "organizador";
      const entry = { ...actor(user), outcome: action.outcome, reason: action.reason.trim() };
      batch.update(ref, direct
        ? { status: "confirmado", proposal: entry, decision: entry, updatedAt: now }
        : { status: "propuesta", proposal: entry, updatedAt: now });
      log(direct ? "confirmado" : "propuesta", action.reason);
      if (direct && action.outcome !== "sin_efecto") {
        batch.update(project, { originalityStatus: { status: "confirmado", outcome: action.outcome, caseId: c.id, at: now } });
      }
      break;
    }
    case "confirmar": {
      if (!c.proposal) throw new Error("No hay propuesta que confirmar");
      batch.update(ref, {
        status: "confirmado",
        decision: { ...actor(user), outcome: c.proposal.outcome, reason: c.proposal.reason },
        updatedAt: now,
      });
      log("confirmado", c.proposal.reason);
      if (c.proposal.outcome !== "sin_efecto") {
        batch.update(project, { originalityStatus: { status: "confirmado", outcome: c.proposal.outcome, caseId: c.id, at: now } });
      }
      break;
    }
    case "rechazar":
      batch.update(ref, { status: "en_revision", proposal: null, updatedAt: now });
      log("propuesta_rechazada", action.note);
      break;
    case "reabrir":
      batch.update(ref, { status: "en_revision", decision: null, proposal: null, updatedAt: now });
      log("reabierto", action.note);
      batch.update(project, { originalityStatus: null });
      break;
    case "responder":
      batch.update(ref, {
        status: "en_revision",
        teamResponse: { ...actor(user), text: action.text.trim(), links: action.links.slice(0, 8) },
        updatedAt: now,
      });
      log("respuesta_equipo", action.text);
      break;
  }
  await batch.commit();
}

/** Datos del otro proyecto, solo si quien mira tiene permiso (admins u organizadores de ese evento). */
export async function readOtherProject(eventId: string, projectId: string) {
  try {
    const snap = await getDoc(projectDocRef(eventId, projectId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as DetectorProject) : null;
  } catch {
    return null;
  }
}

export async function readEventName(eventId: string) {
  try {
    const snap = await getDoc(doc(db, "events", eventId));
    return snap.exists() ? ((snap.data() as EventDoc).name ?? "") : "";
  } catch {
    return "";
  }
}
