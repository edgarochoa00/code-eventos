// Pruebas de las reglas del detector contra el emulador.
// Antes de activar:  npm run detector:test:rules   (usa detector/rules/firestore.rules)
// Ya activado:       RULES=firestore.rules node --test tests/detector.rules.test.mjs (dentro de emulators:exec)
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";

const RULES = process.env.RULES ?? "firestore.rules";
const SUPER = "edgarochoa0173@gmail.com";
let env;
const ctx = (uid, email, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

const signals = {
  sigPhrases: [1, 2],
  sigWords: [3, 4],
  tokenCount: 40,
  shingles: [10, 20, 30],
  urls: [],
  files: [],
  members: [],
  declaredUrls: [],
  contentHash: "abc",
};

let superDb, admin, admin2, org, orgB, judge, ana, luis, outsider;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-code",
    firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8085 },
  });
  // Cada archivo empieza con el emulador vacío (se corren uno tras otro)
  await env.clearFirestore();
  superDb = ctx("super", SUPER);
  admin = ctx("adm", "adm@tec.mx");
  admin2 = ctx("adm2", "adm2@tec.mx");
  org = ctx("org", "org@tec.mx");
  orgB = ctx("orgb", "orgb@tec.mx");
  judge = ctx("judge", "judge@tec.mx");
  ana = ctx("ana", "ana@tec.mx");
  luis = ctx("luis", "luis@tec.mx");
  outsider = ctx("out", "out@tec.mx");

  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "staff/adm@tec.mx"), { email: "adm@tec.mx", role: "admin" });
    await setDoc(doc(db, "staff/adm2@tec.mx"), { email: "adm2@tec.mx", role: "admin" });
    const ev = (owner, organizers) => ({
      name: "Expo",
      ownerId: owner,
      ownerEmail: organizers[0],
      organizerEmails: organizers,
      judgeEmails: ["judge@tec.mx"],
      phases: { prototype: true, final: true },
      submissions: { prototype: true, final: false },
      registrationOpen: true,
      judgingOpen: true,
      maxTeamSize: 4,
      criteria: [{ id: "a", name: "A", description: "", weight: 100 }],
    });
    await setDoc(doc(db, "events/e1"), ev("org", ["org@tec.mx"]));
    await setDoc(doc(db, "events/e2"), ev("orgb", ["orgb@tec.mx"]));
    await setDoc(doc(db, "events/e1/projects/p1"), {
      eventId: "e1",
      title: "Proyecto Beta",
      summary: "s",
      problem: "p",
      solution: "s",
      technologies: [],
      leaderId: "ana",
      leaderEmail: "ana@tec.mx",
      members: [],
      memberEmails: ["ana@tec.mx", "luis@tec.mx"],
      prototype: null,
      final: null,
    });
    await setDoc(doc(db, "events/e2/projects/old"), {
      eventId: "e2",
      title: "Proyecto Alfa",
      leaderEmail: "x@tec.mx",
      memberEmails: ["x@tec.mx"],
    });
  });
});

after(async () => {
  await env?.cleanup();
});

describe("anclas (versiones inmutables)", () => {
  const anchor = (over = {}) => ({
    ...signals,
    projectId: "p1",
    eventId: "e1",
    kind: "registro",
    source: "equipo",
    createdBy: "ana",
    createdAt: serverTimestamp(),
    ...over,
  });

  test("el equipo guarda una versión con hora del servidor", async () => {
    await assertSucceeds(setDoc(doc(ana, "events/e1/projects/p1/anchors/a1"), anchor()));
  });
  test("no se puede poner una fecha falsa", async () => {
    await assertFails(setDoc(doc(ana, "events/e1/projects/p1/anchors/a2"), anchor({ createdAt: Timestamp.fromDate(new Date("2020-01-01")) })));
  });
  test("el equipo no puede crear el sello oficial", async () => {
    await assertFails(setDoc(doc(ana, "events/e1/projects/p1/anchors/a3"), anchor({ kind: "sello" })));
    await assertFails(setDoc(doc(ana, "events/e1/projects/p1/anchors/a4"), anchor({ kind: "sello", source: "organizador" })));
  });
  test("el organizador sella", async () => {
    await assertSucceeds(
      setDoc(doc(org, "events/e1/projects/p1/anchors/s1"), anchor({ kind: "sello", source: "organizador", createdBy: "org" })),
    );
  });
  test("nadie edita ni borra una versión", async () => {
    await assertFails(updateDoc(doc(ana, "events/e1/projects/p1/anchors/a1"), { tokenCount: 1 }));
    await assertFails(updateDoc(doc(superDb, "events/e1/projects/p1/anchors/a1"), { tokenCount: 1 }));
    await assertFails(deleteDoc(doc(org, "events/e1/projects/p1/anchors/a1")));
  });
  test("lectura: equipo y organizador sí; otros no", async () => {
    await assertSucceeds(getDocs(collection(luis, "events/e1/projects/p1/anchors")));
    await assertSucceeds(getDocs(collection(org, "events/e1/projects/p1/anchors")));
    await assertFails(getDocs(collection(outsider, "events/e1/projects/p1/anchors")));
    await assertFails(getDocs(collection(judge, "events/e1/projects/p1/anchors")));
  });
  test("un extraño no guarda versiones de otro proyecto", async () => {
    await assertFails(setDoc(doc(outsider, "events/e1/projects/p1/anchors/x"), anchor({ createdBy: "out" })));
  });
});

describe("proyecto", () => {
  test("al registrar, createdAt debe ser la hora del servidor", async () => {
    const base = {
      eventId: "e1",
      title: "Nuevo",
      summary: "s",
      problem: "p",
      solution: "s",
      technologies: [],
      leaderId: "out",
      leaderEmail: "out@tec.mx",
      members: [],
      memberEmails: ["out@tec.mx"],
      prototype: null,
      final: null,
      updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(outsider, "events/e1/projects/n1"), { ...base, createdAt: Timestamp.fromDate(new Date("2023-01-01")) }));
    await assertSucceeds(setDoc(doc(outsider, "events/e1/projects/n2"), { ...base, createdAt: serverTimestamp() }));
  });
  test("el equipo no puede poner ni quitar la marca de originalidad", async () => {
    await assertFails(updateDoc(doc(ana, "events/e1/projects/p1"), { originalityStatus: null, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(org, "events/e1/projects/p1"), { originalityStatus: null }));
  });
});

describe("índice y pares de palabras sellados", () => {
  const index = (eventId, by) => ({ eventId, eventName: "Expo", year: 2026, chunk: 0, entries: [], sealedBy: by, sealedAt: serverTimestamp() });

  test("solo el organizador del evento escribe su índice", async () => {
    await assertSucceeds(setDoc(doc(org, "originalityIndex/e1"), index("e1", "org")));
    await assertSucceeds(setDoc(doc(org, "originalityIndex/e1__1"), { ...index("e1", "org"), chunk: 1 }));
    await assertFails(setDoc(doc(orgB, "originalityIndex/e1"), index("e1", "orgb")));
    await assertFails(setDoc(doc(orgB, "originalityIndex/e1__9"), index("e2", "orgb")));
    await assertFails(setDoc(doc(ana, "originalityIndex/e1"), index("e1", "ana")));
  });
  test("cualquier cuenta verificada lee el índice (solo hashes)", async () => {
    await assertSucceeds(getDocs(collection(outsider, "originalityIndex")));
  });
  test("pares de palabras: los escribe el organizador, no el equipo", async () => {
    const data = (by) => ({ projectId: "p1", eventId: "e1", shingles: [1, 2], sealedAt: serverTimestamp(), by });
    await assertSucceeds(setDoc(doc(org, "originalityShingles/p1"), data("org")));
    await assertFails(setDoc(doc(ana, "originalityShingles/p1"), data("ana")));
    await assertFails(setDoc(doc(orgB, "originalityShingles/p1"), { ...data("orgb"), eventId: "e2" }));
  });
  test("las huellas del detector anterior ya no se escriben", async () => {
    await assertFails(setDoc(doc(ana, "fingerprints/p1"), { projectId: "p1", eventId: "e1" }));
    await assertFails(getDocs(collection(outsider, "fingerprints")));
  });
});

describe("casos con revisión humana", () => {
  const ID = "p1__old";
  const newCase = (by) => ({
    eventId: "e1",
    projectId: "p1",
    otherProjectId: "old",
    otherEventId: "e2",
    otherYear: 2024,
    firstSeenAt: 2,
    otherFirstSeenAt: 1,
    evidence: { level: "texto" },
    matchedShingles: [10, 20],
    status: "por_revisar",
    teamNotified: false,
    teamResponse: null,
    proposal: null,
    decision: null,
    createdBy: by,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const stamp = (uid, extra = {}) => ({ by: uid, byEmail: `${uid}@tec.mx`, at: serverTimestamp(), ...extra });

  test("solo el organizador abre un caso, siempre «por revisar»", async () => {
    await assertFails(setDoc(doc(ana, `events/e1/cases/${ID}`), newCase("ana")));
    await assertFails(setDoc(doc(org, `events/e1/cases/${ID}`), { ...newCase("org"), status: "confirmado" }));
    await assertFails(setDoc(doc(org, "events/e1/cases/otro_id"), newCase("org")));
    await assertSucceeds(setDoc(doc(org, `events/e1/cases/${ID}`), newCase("org")));
  });

  test("el equipo no ve el caso hasta que se le notifica", async () => {
    await assertFails(getDoc(doc(ana, `events/e1/cases/${ID}`)));
    await assertFails(getDocs(query(collection(ana, "events/e1/cases"), where("projectId", "==", "p1"))));
  });

  test("el equipo no puede responder antes del aviso", async () => {
    await assertFails(
      updateDoc(doc(ana, `events/e1/cases/${ID}`), {
        status: "en_revision",
        teamResponse: stamp("ana", { text: "x", links: [] }),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("el organizador notifica y el equipo lo ve", async () => {
    await assertSucceeds(updateDoc(doc(org, `events/e1/cases/${ID}`), { status: "esperando_equipo", teamNotified: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(ana, `events/e1/cases/${ID}`)));
    await assertSucceeds(
      getDocs(query(collection(luis, "events/e1/cases"), where("projectId", "==", "p1"), where("teamNotified", "==", true))),
    );
    await assertFails(getDoc(doc(outsider, `events/e1/cases/${ID}`)));
    await assertFails(getDoc(doc(judge, `events/e1/cases/${ID}`)));
  });

  test("el equipo responde, pero no puede decidir ni tocar otros campos", async () => {
    await assertFails(updateDoc(doc(ana, `events/e1/cases/${ID}`), { status: "descartado", updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(doc(ana, `events/e1/cases/${ID}`), {
        status: "en_revision",
        teamResponse: stamp("ana", { text: "x", links: [] }),
        evidence: { level: "ninguna" },
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(ana, `events/e1/cases/${ID}`), {
        status: "en_revision",
        teamResponse: stamp("ana", { text: "Es la continuación de nuestro proyecto.", links: [] }),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("el organizador no puede editar la respuesta del equipo", async () => {
    await assertFails(updateDoc(doc(org, `events/e1/cases/${ID}`), { teamResponse: null }));
  });

  test("el organizador propone y no puede confirmar solo", async () => {
    await assertSucceeds(
      updateDoc(doc(org, `events/e1/cases/${ID}`), {
        status: "propuesta",
        proposal: stamp("org", { outcome: "penalizacion", reason: "Mismas frases y mismo repo." }),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(org, `events/e1/cases/${ID}`), {
        status: "confirmado",
        decision: stamp("org", { outcome: "penalizacion", reason: "x" }),
      }),
    );
  });

  test("con una propuesta abierta nadie cambia lo propuesto", async () => {
    await assertFails(
      updateDoc(doc(org, `events/e1/cases/${ID}`), { proposal: stamp("adm", { outcome: "descalificacion", reason: "x" }) }),
    );
  });

  test("un admin distinto confirma", async () => {
    await assertSucceeds(
      updateDoc(doc(admin, `events/e1/cases/${ID}`), {
        status: "confirmado",
        decision: stamp("adm", { outcome: "penalizacion", reason: "Mismas frases y mismo repo." }),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test("un caso decidido no se edita; solo un admin lo reabre", async () => {
    await assertFails(updateDoc(doc(org, `events/e1/cases/${ID}`), { evidence: { level: "ninguna" } }));
    await assertFails(updateDoc(doc(org, `events/e1/cases/${ID}`), { status: "en_revision", decision: null, proposal: null }));
    await assertSucceeds(updateDoc(doc(admin2, `events/e1/cases/${ID}`), { status: "en_revision", decision: null, proposal: null }));
  });

  test("quien propone no puede confirmar aunque sea admin", async () => {
    const id2 = "p1__otro";
    await assertSucceeds(setDoc(doc(admin, `events/e1/cases/${id2}`), { ...newCase("adm"), otherProjectId: "otro" }));
    await assertSucceeds(
      updateDoc(doc(admin, `events/e1/cases/${id2}`), {
        status: "propuesta",
        proposal: stamp("adm", { outcome: "aviso_jueces", reason: "Revisado." }),
      }),
    );
    await assertFails(
      updateDoc(doc(admin, `events/e1/cases/${id2}`), {
        status: "confirmado",
        decision: stamp("adm", { outcome: "aviso_jueces", reason: "Revisado." }),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(superDb, `events/e1/cases/${id2}`), {
        status: "confirmado",
        decision: stamp("super", { outcome: "aviso_jueces", reason: "Revisado." }),
      }),
    );
  });

  test("descartar exige quién y cuándo", async () => {
    const id3 = "p1__tres";
    await assertSucceeds(setDoc(doc(org, `events/e1/cases/${id3}`), { ...newCase("org"), otherProjectId: "tres" }));
    await assertFails(updateDoc(doc(org, `events/e1/cases/${id3}`), { status: "descartado", decision: { by: "otro", at: serverTimestamp() } }));
    await assertSucceeds(
      updateDoc(doc(org, `events/e1/cases/${id3}`), { status: "descartado", decision: stamp("org", { outcome: "sin_efecto", reason: "Es plantilla." }) }),
    );
  });

  test("nadie borra un caso salvo el superadmin", async () => {
    await assertFails(deleteDoc(doc(org, `events/e1/cases/${ID}`)));
    await assertFails(deleteDoc(doc(admin, `events/e1/cases/${ID}`)));
  });

  test("organizador de otro evento no ve ni toca el caso", async () => {
    await assertFails(getDoc(doc(orgB, `events/e1/cases/${ID}`)));
    await assertFails(updateDoc(doc(orgB, `events/e1/cases/${ID}`), { status: "descartado" }));
  });
});

describe("historial del caso", () => {
  const ID = "p1__old";
  const entry = (uid, over = {}) => ({ action: "nota", note: "x", by: uid, byEmail: `${uid}@tec.mx`, at: serverTimestamp(), ...over });

  test("organizador y equipo notificado agregan entradas; nadie las cambia", async () => {
    await assertSucceeds(setDoc(doc(org, `events/e1/cases/${ID}/log/l1`), entry("org")));
    await assertSucceeds(setDoc(doc(ana, `events/e1/cases/${ID}/log/l2`), entry("ana")));
    await assertFails(setDoc(doc(outsider, `events/e1/cases/${ID}/log/l3`), entry("out")));
    await assertFails(setDoc(doc(ana, `events/e1/cases/${ID}/log/l4`), entry("org")));
    await assertFails(setDoc(doc(org, `events/e1/cases/${ID}/log/l5`), entry("org", { at: Timestamp.fromDate(new Date("2020-01-01")) })));
    await assertFails(updateDoc(doc(org, `events/e1/cases/${ID}/log/l1`), { note: "cambiado" }));
    await assertFails(deleteDoc(doc(superDb, `events/e1/cases/${ID}/log/l1`)));
  });

  test("caso + entrada en el mismo lote (como lo hace la app)", async () => {
    const b = writeBatch(org);
    b.set(doc(org, "events/e1/cases/p1__lote"), {
      eventId: "e1",
      projectId: "p1",
      otherProjectId: "lote",
      otherEventId: "e2",
      otherYear: 2024,
      firstSeenAt: 2,
      otherFirstSeenAt: 1,
      evidence: { level: "enlace" },
      matchedShingles: [],
      status: "por_revisar",
      teamNotified: false,
      teamResponse: null,
      proposal: null,
      decision: null,
      createdBy: "org",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    b.set(doc(org, "events/e1/cases/p1__lote/log/l1"), entry("org", { action: "detectado" }));
    await assertSucceeds(b.commit());
  });
});
