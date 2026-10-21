#!/usr/bin/env node
/**
 * Cuentas y datos DEMO para probar cada rol en producción (proyecto code-94fbe).
 *
 *   node scripts/demo-roles.mjs crear   → crea/actualiza cuentas, permisos, evento y proyecto demo
 *   node scripts/demo-roles.mjs borrar  → elimina todo lo que creó este script
 *
 * Usa la sesión del Firebase CLI (`firebase login`) con una cuenta dueña del proyecto,
 * por eso no necesita llaves de servicio. Los correos usan example.com (dominio reservado).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const PROJECT = "code-94fbe";
const PASSWORD = process.env.DEMO_PASSWORD ?? "CodeDemo2026!";
const EVENT_ID = "demo-expo";
const PROJECT_ID = "demo-huerto";
const OLD_EVENT_ID = "demo-expo-2024";
const OLD_PROJECT_ID = "demo-huerto-2024";

const ACCOUNTS = [
  { key: "admin", email: "demo.admin@example.com", name: "Demo Admin", staff: "admin" },
  { key: "organizador", email: "demo.organizador@example.com", name: "Demo Organizador", staff: "organizer" },
  { key: "coorganizador", email: "demo.coorganizador@example.com", name: "Demo Coorganizador" },
  { key: "juez", email: "demo.juez@example.com", name: "Demo Juez" },
  { key: "alumno", email: "demo.alumno@example.com", name: "Demo Alumno Líder" },
  { key: "integrante", email: "demo.integrante@example.com", name: "Demo Integrante" },
  { key: "nuevo", email: "demo.nuevo@example.com", name: "Demo Alumno Nuevo" },
  { key: "suspendido", email: "demo.suspendido@example.com", name: "Demo Suspendido", staff: "blocked" },
];

/* ---------- Autenticación con el token del Firebase CLI ---------- */

function token() {
  // Este comando renueva el token guardado si ya expiró
  try {
    execFileSync("firebase", ["projects:list", "--json"], { stdio: "ignore" });
  } catch {
    execFileSync("npx", ["-y", "firebase-tools@15", "projects:list", "--json"], { stdio: "ignore" });
  }
  const store = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, "utf8"));
  if (!store.tokens?.access_token) throw new Error("Inicia sesión con `firebase login` primero.");
  return store.tokens.access_token;
}
const TOKEN = token();
const headers = { Authorization: `Bearer ${TOKEN}`, "x-goog-user-project": PROJECT, "Content-Type": "application/json" };

async function api(method, url, body) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 404) throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

const IDT = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}`;
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/* ---------- Firestore REST ---------- */

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
  return { stringValue: String(v) };
}
const setDoc = (path, data) =>
  api("PATCH", `${FS}/${path}`, { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) });
const delDoc = (path) => api("DELETE", `${FS}/${path}`);

/* ---------- Huella (misma lógica que lib/similarity.ts) ---------- */

async function fingerprint(project, eventName, year) {
  const { buildFingerprint } = await import("../lib/similarity.ts");
  const fp = await buildFingerprint({ ...project, createdAt: { toDate: () => new Date(`${year}-10-01`) } }, eventName);
  return { ...fp, updatedAt: new Date() };
}

/* ---------- Cuentas ---------- */

async function lookup(emails) {
  const r = await api("POST", `${IDT}/accounts:lookup`, { email: emails });
  return Object.fromEntries((r.users ?? []).map((u) => [u.email, u.localId]));
}

async function ensureAccount(a, existing) {
  if (existing[a.email]) {
    await api("POST", `${IDT}/accounts:update`, {
      localId: existing[a.email],
      password: PASSWORD,
      displayName: a.name,
      emailVerified: true,
      disableUser: false,
    });
    return existing[a.email];
  }
  const r = await api("POST", `${IDT}/accounts`, { email: a.email, password: PASSWORD, displayName: a.name, emailVerified: true });
  return r.localId;
}

/* ---------- Comandos ---------- */

async function crear() {
  const existing = await lookup(ACCOUNTS.map((a) => a.email));
  const uid = {};
  for (const a of ACCOUNTS) {
    uid[a.key] = await ensureAccount(a, existing);
    await setDoc(`users/${uid[a.key]}`, { uid: uid[a.key], email: a.email, displayName: a.name, photoURL: "", lastLoginAt: new Date() });
    if (a.staff) await setDoc(`staff/${a.email}`, { email: a.email, role: a.staff, updatedBy: "demo-script", updatedAt: new Date() });
    else await delDoc(`staff/${a.email}`);
    console.log(`  cuenta  ${a.email.padEnd(32)} ${a.staff ?? "usuario"}`);
  }
  const em = Object.fromEntries(ACCOUNTS.map((a) => [a.key, a.email]));

  const criteria = [
    { id: "innovacion", name: "Innovación", description: "Qué tan original y novedosa es la propuesta.", weight: 25 },
    { id: "tecnica", name: "Viabilidad técnica", description: "Calidad de la solución y su implementación.", weight: 25 },
    { id: "impacto", name: "Impacto", description: "Beneficio real para usuarios o comunidad.", weight: 20 },
    { id: "funcionalidad", name: "Funcionalidad", description: "Qué tanto funciona lo que se presenta.", weight: 15 },
    { id: "presentacion", name: "Presentación", description: "Claridad del pitch y de la documentación.", weight: 15 },
  ];
  const baseEvent = {
    institution: "Instituto Tecnológico de Culiacán (DEMO)",
    phases: { prototype: true, final: true },
    maxTeamSize: 5,
    criteria,
    results: null,
    ownerId: uid.organizador,
    ownerEmail: em.organizador,
  };

  await setDoc(`events/${EVENT_ID}`, {
    ...baseEvent,
    name: "DEMO · Expo de Proyectos",
    description: "Evento de demostración para probar cada rol. Se puede borrar con `node scripts/demo-roles.mjs borrar`.",
    code: "DEMO26",
    organizerEmails: [em.organizador, em.coorganizador],
    judgeEmails: [em.juez],
    submissions: { prototype: true, final: false },
    registrationOpen: true,
    judgingOpen: true,
    resultsPublished: false,
    originality: { judges: "always", teams: "hidden", teamsFrom: "" },
    startDate: "2026-11-10",
    endDate: "2026-11-14",
    createdAt: new Date(),
  });
  await setDoc(`events/${OLD_EVENT_ID}`, {
    ...baseEvent,
    name: "DEMO · Expo 2024 (histórico)",
    description: "Evento histórico de demostración para la detección de plagio.",
    code: "DEMO24",
    organizerEmails: [em.organizador],
    judgeEmails: [],
    submissions: { prototype: false, final: false },
    registrationOpen: false,
    judgingOpen: false,
    resultsPublished: true,
    startDate: "2024-11-10",
    endDate: "2024-11-12",
    createdAt: new Date("2024-10-01"),
  });

  // Texto deliberadamente parecido entre ambos proyectos para mostrar la alerta de originalidad
  const content = {
    summary: "DEMO: huerto escolar que se riega solo con sensores de humedad y una bomba controlada por ESP32.",
    problem:
      "DEMO: las plantas del huerto demostrativo se marchitan los fines de semana porque nadie las riega y cuando se riegan se usa demasiada agua sin medir la tierra.",
    solution:
      "DEMO: un ESP32 lee sensores capacitivos de humedad, enciende una bomba peristáltica solo cuando la tierra está seca y manda avisos a un tablero web de demostración.",
    technologies: ["ESP32", "Firebase"],
    category: "Hardware / IoT",
  };
  const link = "https://github.com/code-demo/huerto-demo";

  const oldProject = {
    id: OLD_PROJECT_ID,
    eventId: OLD_EVENT_ID,
    title: "DEMO · HuertoBot 2024",
    ...content,
    leaderId: "demo-exalumno",
    leaderEmail: "demo.exalumno@example.com",
    members: [{ name: "Demo Exalumno", email: "demo.exalumno@example.com" }],
    memberEmails: ["demo.exalumno@example.com"],
    prototype: { description: "DEMO: prototipo histórico.", links: [{ label: "Repositorio", url: link }], files: [], submittedAt: new Date("2024-11-10"), submittedBy: "demo.exalumno@example.com" },
    final: null,
    createdAt: new Date("2024-10-05"),
    updatedAt: new Date("2024-11-10"),
  };
  const project = {
    id: PROJECT_ID,
    eventId: EVENT_ID,
    title: "DEMO · Huerto Inteligente",
    ...content,
    leaderId: uid.alumno,
    leaderEmail: em.alumno,
    members: [
      { name: "Demo Alumno Líder", email: em.alumno },
      { name: "Demo Integrante", email: em.integrante },
    ],
    memberEmails: [em.alumno, em.integrante],
    prototype: {
      description: "DEMO: prototipo con dos sensores y una bomba controlada por ESP32.",
      links: [{ label: "Repositorio", url: `${link}.git` }],
      files: [],
      submittedAt: new Date(),
      submittedBy: em.alumno,
    },
    final: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  for (const [p, eventName, year] of [
    [oldProject, "DEMO · Expo 2024 (histórico)", 2024],
    [project, "DEMO · Expo de Proyectos", 2026],
  ]) {
    const { id, ...data } = p;
    await setDoc(`events/${p.eventId}/projects/${id}`, data);
    await setDoc(`fingerprints/${id}`, await fingerprint(p, eventName, year));
  }
  console.log("  evento  DEMO · Expo de Proyectos (código DEMO26) y DEMO · Expo 2024 (histórico)");
  console.log("  proyecto DEMO · Huerto Inteligente (alumno + integrante, prototipo entregado)");
  console.log(`\nContraseña de todas las cuentas demo: ${PASSWORD}`);
}

async function borrar() {
  const existing = await lookup(ACCOUNTS.map((a) => a.email));
  const ids = Object.values(existing);
  for (const a of ACCOUNTS) {
    if (existing[a.email]) await delDoc(`users/${existing[a.email]}`);
    await delDoc(`staff/${a.email}`);
  }
  if (ids.length) await api("POST", `${IDT}/accounts:batchDelete`, { localIds: ids, force: true });

  for (const ev of [EVENT_ID, OLD_EVENT_ID]) {
    const evals = await api("GET", `${FS}/events/${ev}/evaluations?pageSize=300`);
    for (const d of evals.documents ?? []) await api("DELETE", `https://firestore.googleapis.com/v1/${d.name}`);
    const projs = await api("GET", `${FS}/events/${ev}/projects?pageSize=300`);
    for (const d of projs.documents ?? []) {
      await api("DELETE", `https://firestore.googleapis.com/v1/${d.name}`);
      await delDoc(`fingerprints/${d.name.split("/").pop()}`);
    }
    await delDoc(`events/${ev}`);
  }
  console.log(`Eliminadas ${ids.length} cuentas demo, sus permisos, eventos, proyectos, evaluaciones y huellas.`);
}

const cmd = process.argv[2];
if (cmd === "crear") await crear();
else if (cmd === "borrar") await borrar();
else {
  console.log("Uso: node scripts/demo-roles.mjs crear | borrar");
  process.exit(1);
}
