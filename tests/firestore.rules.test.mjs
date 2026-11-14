// Pruebas de firestore.rules contra el emulador.
// Uso: npm run test:rules
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const SUPER = "edgarochoa0173@gmail.com";
let env;
const tok = (email, verified = true) => ({ email, email_verified: verified });
const ctx = (uid, email, verified = true) => env.authenticatedContext(uid, tok(email, verified)).firestore();

const criteria = [{ id: "a", name: "A", description: "", weight: 100 }];
const eventFor = (ownerId, ownerEmail) => ({
  accessVersion: 1,
  name: "Expo",
  description: "",
  institution: "",
  code: "ABC123",
  ownerId,
  ownerEmail,
  organizerEmails: [ownerEmail],
  judgeEmails: [],
  judgeAssignments: { "judge@tec.mx": { categories: ["Software", "Carteles", "Prototipos", "Sin personalizar", "Categoría 19"] }, "org@tec.mx": { projectIds: ["cross-event"] } },
  phases: { prototype: true, final: true },
  submissions: { prototype: true, final: false },
  registrationOpen: true,
  judgingOpen: false,
  maxTeamSize: 3,
  criteria,
  startDate: "",
  endDate: "",
  resultsPublished: false,
  results: null,
});
const createEvent = (db, id, data) => {
  const batch = writeBatch(db);
  batch.set(doc(db, `events/${id}`), data);
  batch.set(doc(db, `events/${id}/access/participants`), { members: {}, projectId: "" });
  return batch.commit();
};
const syncTeam = (db, pid, data, before = [], eventId = "e1") => {
  const batch = writeBatch(db);
  const ref = doc(db, `events/${eventId}/projects/${pid}`);
  if (data === null) batch.delete(ref);
  else batch.set(ref, data, { merge: true });
  const after = data?.memberEmails ?? [];
  const fields = [];
  for (const email of before) if (!after.includes(email)) fields.push(new FieldPath("members", email), deleteField());
  for (const email of after) if (!before.includes(email)) fields.push(new FieldPath("members", email), true);
  batch.update(doc(db, `events/${eventId}/access/participants`), "projectId", pid, ...fields);
  return batch.commit();
};
const project = {
  eventId: "e1",
  title: "Proyecto Alfa",
  summary: "Resumen",
  problem: "p",
  solution: "s",
  technologies: [],
  category: "Software",
  leaderId: "stu",
  leaderEmail: "stu@tec.mx",
  members: [],
  memberEmails: ["stu@tec.mx", "mate@tec.mx"],
  prototype: null,
  final: null,
};

let superDb, org, admin, judge, stu, mate, outsider, blocked, fakeJudge;

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8085").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-code",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
  superDb = ctx("super", SUPER);
  org = ctx("org", "org@tec.mx");
  admin = ctx("adm", "adm@tec.mx");
  judge = ctx("judge", "judge@tec.mx");
  fakeJudge = ctx("fake", "judge@tec.mx", false);
  stu = ctx("stu", "stu@tec.mx");
  mate = ctx("mate", "mate@tec.mx");
  outsider = ctx("out", "out@tec.mx");
  blocked = ctx("blk", "blk@tec.mx");
});

after(async () => {
  await env?.cleanup();
});

describe("permisos globales", () => {
  test("solo el superadmin asigna permisos", async () => {
    await assertSucceeds(setDoc(doc(superDb, "staff/org@tec.mx"), { email: "org@tec.mx", role: "organizer" }));
    await assertSucceeds(setDoc(doc(superDb, "staff/adm@tec.mx"), { email: "adm@tec.mx", role: "admin" }));
    await assertSucceeds(setDoc(doc(superDb, "staff/blk@tec.mx"), { email: "blk@tec.mx", role: "blocked" }));
    await assertFails(setDoc(doc(admin, "staff/out@tec.mx"), { email: "out@tec.mx", role: "admin" }));
    await assertFails(setDoc(doc(outsider, "staff/out@tec.mx"), { email: "out@tec.mx", role: "admin" }));
  });

  test("nadie puede cambiar ni suspender al superadmin", async () => {
    await assertFails(setDoc(doc(superDb, `staff/${SUPER}`), { email: SUPER, role: "blocked" }));
  });

  test("rol inválido o correo que no coincide se rechaza", async () => {
    await assertFails(setDoc(doc(superDb, "staff/x@tec.mx"), { email: "x@tec.mx", role: "superadmin" }));
    await assertFails(setDoc(doc(superDb, "staff/x@tec.mx"), { email: "y@tec.mx", role: "admin" }));
  });

  test("cada quien lee su propio permiso; los admins leen todos", async () => {
    await assertSucceeds(getDoc(doc(org, "staff/org@tec.mx")));
    await assertSucceeds(getDoc(doc(outsider, "staff/out@tec.mx")));
    await assertFails(getDoc(doc(outsider, "staff/org@tec.mx")));
    await assertSucceeds(getDocs(collection(admin, "staff")));
  });

  test("solo admins listan usuarios", async () => {
    await assertSucceeds(setDoc(doc(stu, "users/stu"), { uid: "stu", email: "stu@tec.mx" }));
    await assertSucceeds(getDoc(doc(stu, "users/stu")));
    await assertFails(getDocs(collection(stu, "users")));
    await assertSucceeds(getDocs(collection(admin, "users")));
    await assertSucceeds(getDocs(collection(superDb, "users")));
  });
});

describe("eventos", () => {
  test("solo superadmin, admin u organizador crean eventos", async () => {
    await assertSucceeds(createEvent(org, "e1", eventFor("org", "org@tec.mx")));
    await assertSucceeds(createEvent(superDb, "e2", eventFor("super", SUPER)));
    await assertSucceeds(createEvent(admin, "e3", eventFor("adm", "adm@tec.mx")));
    await assertFails(createEvent(stu, "e4", eventFor("stu", "stu@tec.mx")));
  });

  test("no se crea un evento a nombre de otro", async () => {
    await assertFails(setDoc(doc(org, "events/e5"), eventFor("other", "other@tec.mx")));
  });

  test("organizador y admin global editan; alumno no", async () => {
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx"] }));
    await assertSucceeds(updateDoc(doc(admin, "events/e1"), { description: "editado por admin" }));
    await assertSucceeds(updateDoc(doc(superDb, "events/e1"), { description: "editado por superadmin" }));
    await assertFails(updateDoc(doc(stu, "events/e1"), { judgeEmails: ["stu@tec.mx"] }));
  });

  test("no se puede quitar al creador de los organizadores", async () => {
    await assertFails(updateDoc(doc(superDb, "events/e1"), { organizerEmails: ["x@tec.mx"] }));
  });

  test("organizador y juez son incompatibles incluso con escrituras directas", async () => {
    await assertFails(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx", "org@tec.mx"] }));
    await assertFails(updateDoc(doc(admin, "events/e1"), { organizerEmails: ["org@tec.mx", "judge@tec.mx"] }));
  });

  test("búsqueda por código", async () => {
    await assertSucceeds(getDocs(query(collection(outsider, "events"), where("code", "==", "ABC123"))));
  });

  test("cada evento guarda las entregas y la rúbrica que define su organizador", async () => {
    const carteles = {
      ...eventFor("org", "org@tec.mx"),
      name: "Carteles",
      phases: { prototype: true, final: false },
      phaseDetails: { prototype: { name: "Cartel", description: "Presenta tu investigación en PDF." } },
      criteria: [{ id: "diseno", name: "Diseño del cartel", description: "Claridad visual", weight: 100 }],
    };
    const prototipos = {
      ...eventFor("org", "org@tec.mx"),
      name: "Prototipos",
      phases: { prototype: true, final: false },
      phaseDetails: { prototype: { name: "Modelo funcional", description: "Presenta su funcionamiento." } },
      criteria: [{ id: "prueba", name: "Demostración", description: "Funcionamiento en vivo", weight: 100 }],
    };
    await assertSucceeds(createEvent(org, "custom-carteles", carteles));
    await assertSucceeds(createEvent(org, "custom-prototipos", prototipos));
    const first = (await getDoc(doc(stu, "events/custom-carteles"))).data();
    const second = (await getDoc(doc(judge, "events/custom-prototipos"))).data();
    assert.deepEqual(first.phaseDetails, carteles.phaseDetails);
    assert.deepEqual(first.criteria, carteles.criteria);
    assert.deepEqual(second.phaseDetails, prototipos.phaseDetails);
    assert.deepEqual(second.criteria, prototipos.criteria);
    await assertSucceeds(updateDoc(doc(org, "events/custom-carteles"), {
      "phaseDetails.prototype.name": "Cartel científico",
    }));
    await assertFails(updateDoc(doc(stu, "events/custom-carteles"), {
      "phaseDetails.prototype.name": "Cambiado por alumno",
    }));
    await assertFails(updateDoc(doc(judge, "events/custom-carteles"), { criteria: prototipos.criteria }));
    assert.equal((await getDoc(doc(org, "events/custom-prototipos"))).data().phaseDetails.prototype.name, "Modelo funcional");
  });
});

describe("cuenta suspendida", () => {
  test("no puede registrar proyectos ni leer huellas", async () => {
    await assertFails(
      setDoc(doc(blocked, "events/e1/projects/pb"), {
        ...project,
        leaderId: "blk",
        leaderEmail: "blk@tec.mx",
        memberEmails: ["blk@tec.mx"],
      }),
    );
    await assertFails(getDocs(collection(blocked, "fingerprints")));
    await assertFails(getDoc(doc(blocked, "events/e1")));
  });
});

describe("proyectos", () => {
  test("alumno registra su proyecto", async () => {
    await assertFails(setDoc(doc(stu, "events/e1/projects/p1"), project));
    await assertSucceeds(syncTeam(stu, "p1", project));
  });

  test("un concursante no se convierte en juez u organizador desde la API", async () => {
    await assertFails(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx", "mate@tec.mx"] }));
    await assertFails(updateDoc(doc(admin, "events/e1"), { organizerEmails: ["org@tec.mx", "stu@tec.mx"] }));
    const batch = writeBatch(admin);
    batch.update(doc(admin, "events/e1"), { judgeEmails: ["judge@tec.mx", "mate@tec.mx"] });
    batch.update(doc(admin, "events/e1/access/participants"), new FieldPath("members", "mate@tec.mx"), deleteField());
    await assertFails(batch.commit());
  });

  test("el registro privado no expone correos ni permite falsear integrantes", async () => {
    await assertFails(getDoc(doc(stu, "events/e1/access/participants")));
    await assertSucceeds(getDoc(doc(org, "events/e1/access/participants")));
    await assertFails(updateDoc(doc(org, "events/e1/access/participants"), { members: {}, projectId: "p1" }));
    await assertFails(updateDoc(doc(stu, "events/e1/access/participants"), new FieldPath("members", "out@tec.mx"), true));
  });

  test("no se puede usar un integrante de otro proyecto aunque se omita la interfaz", async () => {
    await assertFails(syncTeam(outsider, "duplicate", { ...project, leaderId: "out", leaderEmail: "out@tec.mx", memberEmails: ["out@tec.mx", "mate@tec.mx"] }));
  });

  test("equipo más grande que el máximo falla", async () => {
    await assertFails(
      setDoc(doc(outsider, "events/e1/projects/p2"), {
        ...project,
        leaderId: "out",
        leaderEmail: "out@tec.mx",
        memberEmails: ["out@tec.mx", "a@a.mx", "b@b.mx", "c@c.mx"],
      }),
    );
  });

  test("no se crea con resultados ya puestos", async () => {
    await assertFails(
      setDoc(doc(outsider, "events/e1/projects/p3"), {
        ...project,
        leaderId: "out",
        leaderEmail: "out@tec.mx",
        memberEmails: ["out@tec.mx"],
        feedback: {},
      }),
    );
  });

  test("lectura: integrantes, jueces, organizadores y admins", async () => {
    await assertSucceeds(getDoc(doc(mate, "events/e1/projects/p1")));
    await assertSucceeds(getDoc(doc(judge, "events/e1/projects/p1")));
    await assertSucceeds(getDoc(doc(admin, "events/e1/projects/p1")));
    await assertFails(getDoc(doc(outsider, "events/e1/projects/p1")));
    await assertFails(getDoc(doc(fakeJudge, "events/e1/projects/p1")));
  });

  test("consultas de mis proyectos y vista global de admin", async () => {
    await assertSucceeds(
      getDocs(query(collectionGroup(mate, "projects"), where("memberEmails", "array-contains", "mate@tec.mx"))),
    );
    await assertSucceeds(getDocs(collectionGroup(admin, "projects")));
    await assertFails(getDocs(collectionGroup(stu, "projects")));
    await assertFails(getDocs(collection(outsider, "events/e1/projects")));
  });

  test("entregas solo con la etapa abierta", async () => {
    const sub = { description: "x", links: [], files: [], submittedAt: null, submittedBy: "mate@tec.mx" };
    await assertSucceeds(updateDoc(doc(mate, "events/e1/projects/p1"), { prototype: sub }));
    await assertFails(updateDoc(doc(mate, "events/e1/projects/p1"), { final: sub }));
    await assertFails(updateDoc(doc(mate, "events/e1/projects/p1"), { feedback: { prototype: {} } }));
    await assertFails(updateDoc(doc(mate, "events/e1/projects/p1"), { memberEmails: ["mate@tec.mx"] }));
  });

  test("jueces y organizadores no concursan en su propio evento", async () => {
    await assertFails(
      setDoc(doc(judge, "events/e1/projects/pj"), {
        ...project,
        leaderId: "judge",
        leaderEmail: "judge@tec.mx",
        memberEmails: ["judge@tec.mx"],
      }),
    );
    await assertFails(
      setDoc(doc(org, "events/e1/projects/po"), {
        ...project,
        leaderId: "org",
        leaderEmail: "org@tec.mx",
        memberEmails: ["org@tec.mx"],
      }),
    );
    await assertFails(
      setDoc(doc(outsider, "events/e1/projects/p5"), {
        ...project,
        leaderId: "out",
        leaderEmail: "out@tec.mx",
        memberEmails: ["out@tec.mx", "judge@tec.mx"],
      }),
    );
    await assertFails(
      updateDoc(doc(stu, "events/e1/projects/p1"), { memberEmails: ["stu@tec.mx", "mate@tec.mx", "judge@tec.mx"] }),
    );
    await assertFails(
      updateDoc(doc(stu, "events/e1/projects/p1"), { memberEmails: ["stu@tec.mx", "mate@tec.mx", "org@tec.mx"] }),
    );
  });

  test("solo el líder cambia el equipo", async () => {
    const team = ["stu@tec.mx", "mate@tec.mx", "x@tec.mx"];
    await assertFails(updateDoc(doc(mate, "events/e1/projects/p1"), { memberEmails: team }));
    await assertFails(updateDoc(doc(stu, "events/e1/projects/p1"), { memberEmails: team }));
    await assertSucceeds(syncTeam(stu, "p1", { memberEmails: team }, project.memberEmails));
    await assertSucceeds(syncTeam(stu, "p1", { memberEmails: project.memberEmails }, team));
  });

  test("admite equipos de 15 integrantes sin exceder los límites de reglas", async () => {
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { maxTeamSize: 15 }));
    const emails = ["out@tec.mx", ...Array.from({ length: 14 }, (_, i) => `team15-${i}@tec.mx`)];
    await assertSucceeds(syncTeam(outsider, "team15", { ...project, leaderId: "out", leaderEmail: "out@tec.mx", memberEmails: emails }));
    await assertSucceeds(syncTeam(outsider, "team15", null, emails));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { maxTeamSize: 3 }));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx", "out@tec.mx"] }));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx"] }));
  });

  test("dos registros concurrentes no pueden compartir un integrante", async () => {
    const dbs = [ctx("race-a", "race-a@tec.mx"), ctx("race-b", "race-b@tec.mx")];
    const teams = dbs.map((_, index) => ({ ...project, leaderId: index ? "race-b" : "race-a", leaderEmail: index ? "race-b@tec.mx" : "race-a@tec.mx", memberEmails: [index ? "race-b@tec.mx" : "race-a@tec.mx", "shared@tec.mx"] }));
    const results = await Promise.allSettled(dbs.map((db, index) => syncTeam(db, `race-${index}`, teams[index])));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const winner = results.findIndex((r) => r.status === "fulfilled");
    await assertSucceeds(syncTeam(dbs[winner], `race-${winner}`, null, teams[winner].memberEmails));
  });

  test("un organizador global puede concursar y ser juez en otros eventos, con roles separados", async () => {
    const other = { ...project, eventId: "e2", leaderId: "org", leaderEmail: "org@tec.mx", memberEmails: ["org@tec.mx"] };
    await assertSucceeds(syncTeam(org, "other", other, [], "e2"));
    await assertFails(updateDoc(doc(superDb, "events/e2"), { judgeEmails: ["org@tec.mx"] }));
    await assertSucceeds(syncTeam(org, "other", null, other.memberEmails, "e2"));
    await assertSucceeds(updateDoc(doc(superDb, "events/e2"), { judgeEmails: ["org@tec.mx"] }));
    await assertSucceeds(syncTeam(stu, "cross-event", { ...project, eventId: "e2" }, [], "e2"));
    await assertSucceeds(updateDoc(doc(superDb, "events/e2"), { judgingOpen: true, categoryLocked: true }));
    await assertSucceeds(setDoc(doc(org, "events/e2/evaluations/org_cross-event_prototype"), {
      eventId: "e2", projectId: "cross-event", phase: "prototype", judgeId: "org", judgeEmail: "org@tec.mx", judgeName: "", scores: { a: 8 }, total: 80, comment: "Buen trabajo",
    }));
  });

  test("una promoción a admin revoca las modificaciones del antiguo integrante", async () => {
    await assertSucceeds(setDoc(doc(superDb, "staff/mate@tec.mx"), { email: "mate@tec.mx", role: "admin" }));
    await assertFails(updateDoc(doc(mate, "events/e1/projects/p1"), { title: "Admin competidor" }));
    await assertFails(updateDoc(doc(mate, "events/e1/projects/p1"), { prototype: null }));
    await assertSucceeds(deleteDoc(doc(superDb, "staff/mate@tec.mx")));
  });

  test("un integrante agregado como juez en datos antiguos no modifica su proyecto ni califica otros", async () => {
    const other = { ...project, leaderId: "out", leaderEmail: "out@tec.mx", memberEmails: ["out@tec.mx"] };
    await assertSucceeds(syncTeam(outsider, "legacy-conflict", other));
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(doc(c.firestore(), "events/e1"), { judgeEmails: ["judge@tec.mx", "mate@tec.mx"], judgingOpen: true, categoryLocked: true });
    });
    await assertFails(getDoc(doc(mate, "events/e1/projects/legacy-conflict")));
    await assertFails(updateDoc(doc(mate, "events/e1/projects/p1"), { title: "Juez competidor" }));
    await assertFails(setDoc(doc(mate, "events/e1/evaluations/mate_legacy-conflict_prototype"), {
      eventId: "e1", projectId: "legacy-conflict", phase: "prototype", judgeId: "mate", judgeEmail: "mate@tec.mx", judgeName: "", scores: { a: 8 }, total: 80, comment: "Buen trabajo",
    }));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx"], judgingOpen: false, categoryLocked: true }));
    await assertSucceeds(syncTeam(outsider, "legacy-conflict", null, other.memberEmails));
  });

  test("el organizador no edita el contenido del proyecto", async () => {
    await assertFails(updateDoc(doc(org, "events/e1/projects/p1"), { title: "Cambiado por organizador" }));
    await assertFails(
      updateDoc(doc(org, "events/e1/projects/p1"), { feedback: { prototype: {} }, title: "Cambiado por organizador" }),
    );
  });
});

describe("logo opcional del proyecto", () => {
  const eventId = "logo-event";
  const path = `events/${eventId}/projects/p1`;
  const logo = { path: `${path}/logo/11111111-1111-4111-8111-111111111111.webp`, storage: "supabase" };

  before(async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `events/${eventId}`), { ...eventFor("org", "org@tec.mx"), judgeEmails: ["judge@tec.mx"] });
      await setDoc(doc(db, `events/${eventId}/access/participants`), { members: { "stu@tec.mx": true, "mate@tec.mx": true }, projectId: "p1" });
      await setDoc(doc(db, path), { ...project, eventId });
    });
  });
  const changeEvent = patch => env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), `events/${eventId}`), patch));
  const changeProject = patch => env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), path), patch));

  test("el líder puede guardar y quitar su logo; integrantes y revisores no", async () => {
    await assertSucceeds(updateDoc(doc(stu, path), { logo }));
    for (const db of [mate, judge, org, admin, superDb, outsider]) {
      await assertFails(updateDoc(doc(db, path), { logo: null }));
    }
    await assertSucceeds(getDoc(doc(mate, path)));
    await assertSucceeds(getDoc(doc(judge, path)));
    await assertSucceeds(getDoc(doc(org, path)));
    await assertSucceeds(updateDoc(doc(stu, path), { logo: null }));
  });
  test("rechaza rutas de otro proyecto, URLs públicas y metadatos adicionales", async () => {
    for (const value of [
      { ...logo, path: logo.path.replace("projects/p1", "projects/p2") },
      { ...logo, path: "https://example.test/logo.png" },
      { ...logo, path: logo.path.replace(".webp", ".svg") },
      { ...logo, url: "https://example.test" },
      { ...logo, storage: "firebase" },
    ]) await assertFails(updateDoc(doc(stu, path), { logo: value }));
  });
  test("el guardado REST del servidor respeta permisos y rechaza una versión desactualizada", async () => {
    // Token sin firma exclusivo del emulador, equivalente al contexto stu de estas pruebas.
    const base64 = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = `${base64({ alg: "none", typ: "JWT" })}.${base64({
      aud: "demo-code", iss: "https://securetoken.google.com/demo-code", sub: "stu", user_id: "stu",
      email: "stu@tec.mx", email_verified: true, iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, firebase: { sign_in_provider: "custom", identities: {} },
    })}.`;
    const database = "projects/demo-code/databases/(default)/documents";
    const origin = `http://${process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8085"}/v1`;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const snapshot = await fetch(`${origin}/${database}/${path}`, { headers }).then(response => response.json());
    const write = {
      update: { name: `${database}/${path}`, fields: { logo: { mapValue: { fields: {
        path: { stringValue: logo.path }, storage: { stringValue: "supabase" },
      } } } } }, updateMask: { fieldPaths: ["logo"] }, currentDocument: { updateTime: snapshot.updateTime },
      updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
    };
    const commit = () => fetch(`${origin}/${database}:commit`, { method: "POST", headers, body: JSON.stringify({ writes: [write] }) });
    assert.equal((await commit()).status, 200);
    const stale = await commit();
    assert.ok([400, 409, 412].includes(stale.status), `No se rechazó la versión anterior: ${stale.status}`);
    await assertSucceeds(updateDoc(doc(stu, path), { logo: null }));
  });
  test("con entregas abiertas el líder puede cambiar el logo aunque el registro esté cerrado", async () => {
    await changeEvent({ registrationOpen: false, submissions: { prototype: true, final: false } });
    await assertSucceeds(updateDoc(doc(stu, path), { logo }));
  });
  test("con todo cerrado o con resultados publicados el logo no cambia", async () => {
    await changeEvent({ registrationOpen: false, submissions: { prototype: false, final: false } });
    await assertFails(updateDoc(doc(stu, path), { logo: null }));
    await changeEvent({ registrationOpen: true, resultsPublished: true });
    await assertFails(updateDoc(doc(stu, path), { logo: null }));
    await changeEvent({ resultsPublished: false });
  });
  test("un registro pendiente no permite agregar logo aunque complete el formulario en la misma escritura", async () => {
    await changeProject({ registrationPending: true });
    await assertFails(updateDoc(doc(stu, path), { logo: null }));
    await assertFails(updateDoc(doc(stu, path), {
      logo: null, registrationPending: false, title: "Mi marca escolar", summary: "Resumen con suficientes caracteres",
      problem: "Problema con suficientes caracteres", solution: "Solución con suficientes caracteres",
      members: [{ email: "stu@tec.mx", name: "Alumno líder" }, { email: "mate@tec.mx", name: "Alumno integrante" }],
    }));
    await changeProject({ registrationPending: false });
  });
});

describe("evaluaciones", () => {
  const evalDoc = {
    eventId: "e1",
    projectId: "p1",
    phase: "prototype",
    judgeId: "judge",
    judgeEmail: "judge@tec.mx",
    judgeName: "",
    scores: { a: 8 },
    total: 80,
    comment: "Buen trabajo",
  };

  test("el juez solo califica con la evaluación abierta", async () => {
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), evalDoc));
    await updateDoc(doc(org, "events/e1"), { judgingOpen: true, categoryLocked: true });
    await assertSucceeds(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), evalDoc));
  });

  test("validaciones de la evaluación", async () => {
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/other_p1_prototype"), evalDoc));
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), { ...evalDoc, total: 150 }));
    // El comentario para el equipo es obligatorio.
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), { ...evalDoc, comment: "" }));
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), { ...evalDoc, comment: "   " }));
    await assertFails(
      setDoc(doc(stu, "events/e1/evaluations/stu_p1_prototype"), { ...evalDoc, judgeId: "stu", judgeEmail: "stu@tec.mx" }),
    );
  });

  test("la asignación limita las escrituras y las listas vacías no dan acceso", async () => {
    const ref = doc(judge, "events/e1/evaluations/judge_p1_prototype");
    for (const [assignment, allowed] of [
      [{ categories: ["Hardware"] }, false],
      [{ categories: ["Hardware"], projectIds: ["p1"] }, true],
      [{ categories: ["Software"] }, true],
      [{ categories: [], projectIds: [] }, false],
      [{}, false],
    ]) {
      await env.withSecurityRulesDisabled(c => deleteDoc(doc(c.firestore(), "events/e1/evaluations/judge_p1_prototype")));
      await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeAssignments: { "judge@tec.mx": assignment } }));
      await (allowed ? assertSucceeds : assertFails)(setDoc(ref, evalDoc));
    }
    await updateDoc(doc(org, "events/e1"), { judgeAssignments: { "judge@tec.mx": { projectIds: ["p1"] } } });
  });

  test("solo se admite el primer envío, incluso con escrituras simultáneas", async () => {
    const ref = doc(judge, "events/e1/evaluations/judge_p1_prototype");
    await assertSucceeds(getDoc(ref)); // La transacción puede comprobar que todavía no existe.
    const results = await Promise.allSettled([setDoc(ref, evalDoc), setDoc(ref, { ...evalDoc, scores: { a: 0 }, total: 0 })]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    await assertFails(updateDoc(ref, { comment: "Otro envío" }));
    await assertFails(deleteDoc(ref));
    await assertFails(setDoc(ref, evalDoc));
  });

  test("no se califican etapas deshabilitadas", async () => {
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { phases: { prototype: true, final: false } }));
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_final"), { ...evalDoc, phase: "final" }));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { phases: { prototype: true, final: true } }));
  });

  test("máximo por proyecto, selección exclusiva y permisos de configuración", async () => {
    const projectRef = doc(org, "events/e1/projects/p1");
    const changeEvent = patch => env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), "events/e1"), patch));
    const judging = { maxJudges: 1, judgeEmails: ["judge@tec.mx"] };
    try {
      await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx", "out@tec.mx"] }));
      await assertSucceeds(updateDoc(projectRef, { judging }));
      for (const invalid of [
        { maxJudges: 0, judgeEmails: [] }, { maxJudges: 1.5, judgeEmails: [] },
        { maxJudges: 1, judgeEmails: ["judge@tec.mx", "out@tec.mx"] },
        { maxJudges: 2, judgeEmails: ["judge@tec.mx", "judge@tec.mx"] },
        { maxJudges: 1, judgeEmails: ["unknown@tec.mx"] },
        { maxJudges: 1, judgeEmails: ["stu@tec.mx"] },
      ]) await assertFails(updateDoc(projectRef, { judging: invalid }));
      await assertFails(updateDoc(doc(stu, "events/e1/projects/p1"), { judging: { maxJudges: 2, judgeEmails: [] } }));
      await assertFails(updateDoc(doc(judge, "events/e1/projects/p1"), { judging: { maxJudges: 2, judgeEmails: [] } }));
      await assertFails(updateDoc(projectRef, { judging, title: "Cambio de contenido no permitido" }));
      await env.withSecurityRulesDisabled(c => deleteDoc(doc(c.firestore(), "events/e1/evaluations/judge_p1_prototype")));
      await assertSucceeds(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), evalDoc));
      await assertFails(setDoc(doc(outsider, "events/e1/evaluations/out_p1_prototype"), { ...evalDoc, judgeId: "out", judgeEmail: "out@tec.mx" }));
      // Ni siquiera la asignación general del juez vuelve a darle permiso.
      await assertSucceeds(updateDoc(projectRef, { judging: { maxJudges: 1, judgeEmails: [] } }));
      await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), evalDoc));
      await changeEvent({ resultsPublished: true });
      await assertFails(updateDoc(projectRef, { judging }));
    } finally {
      await changeEvent({ resultsPublished: false, judgeEmails: ["judge@tec.mx"] });
      await env.withSecurityRulesDisabled(async c => updateDoc(doc(c.firestore(), "events/e1/projects/p1"), { judging: deleteField() }));
    }
  });

  test("un admin o superadmin en una lista antigua de jueces no califica", async () => {
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx", "adm@tec.mx", SUPER] }));
    await assertFails(setDoc(doc(admin, "events/e1/evaluations/adm_p1_prototype"), { ...evalDoc, judgeId: "adm", judgeEmail: "adm@tec.mx" }));
    await assertFails(setDoc(doc(superDb, "events/e1/evaluations/super_p1_prototype"), { ...evalDoc, judgeId: "super", judgeEmail: SUPER }));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx"] }));
  });

  test("un organizador con rol antiguo de juez no califica", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(doc(c.firestore(), "events/e1"), { judgeEmails: ["judge@tec.mx", "org@tec.mx"] });
    });
    await assertFails(setDoc(doc(org, "events/e1/evaluations/org_p1_prototype"), { ...evalDoc, judgeId: "org", judgeEmail: "org@tec.mx" }));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx"] }));
  });

  test("quitar al juez revoca su permiso de guardar, pero conserva su lectura histórica", async () => {
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: [] }));
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), evalDoc));
    await assertSucceeds(getDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype")));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx"] }));
  });

  test("lectura: el juez las suyas, organizador y admin todas", async () => {
    await assertSucceeds(getDocs(query(collection(judge, "events/e1/evaluations"), where("judgeId", "==", "judge"))));
    await assertSucceeds(getDocs(collection(org, "events/e1/evaluations")));
    await assertSucceeds(getDocs(collection(admin, "events/e1/evaluations")));
    await assertFails(getDocs(collection(stu, "events/e1/evaluations")));
  });

  test("organizador publica resultados en el proyecto", async () => {
    await assertSucceeds(updateDoc(doc(org, "events/e1/projects/p1"), { feedback: { prototype: { score: 80 } } }));
  });

  test("el juez no califica un proyecto del que es integrante", async () => {
    // Se siembra sin reglas porque las reglas ya impiden que un juez sea integrante
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "events/e1/projects/p9"), {
        ...project,
        memberEmails: ["stu@tec.mx", "judge@tec.mx"],
      });
    });
    await assertFails(
      setDoc(doc(judge, "events/e1/evaluations/judge_p9_prototype"), { ...evalDoc, projectId: "p9" }),
    );
  });

  test("con resultados publicados no se borran evaluaciones ni proyectos", async () => {
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { resultsPublished: true }));
    await assertFails(deleteDoc(doc(org, "events/e1/evaluations/judge_p1_prototype")));
    await assertFails(deleteDoc(doc(org, "events/e1/projects/p9")));
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), evalDoc));
    await assertFails(updateDoc(doc(mate, "events/e1/projects/p1"), { title: "Cambio posterior" }));
    await assertFails(syncTeam(stu, "p1", null, project.memberEmails));
  });
});

describe("actualización de eventos antiguos", () => {
  test("solo superadmin prepara el índice y después nadie puede resetearlo", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      const legacy = eventFor("org", "org@tec.mx");
      delete legacy.accessVersion;
      await setDoc(doc(c.firestore(), "events/legacy"), legacy);
      await setDoc(doc(c.firestore(), "events/legacy/projects/old"), { ...project, eventId: "legacy" });
    });
    const prepare = (db) => {
      const batch = writeBatch(db);
      batch.set(doc(db, "events/legacy/access/participants"), { members: { "stu@tec.mx": true, "mate@tec.mx": true }, projectId: "" });
      batch.update(doc(db, "events/legacy"), { accessVersion: 1 });
      return batch.commit();
    };
    await assertFails(updateDoc(doc(org, "events/legacy"), { judgeEmails: ["mate@tec.mx"] }));
    await assertFails(prepare(org));
    await assertFails(prepare(admin));
    await assertSucceeds(prepare(superDb));
    await assertFails(prepare(superDb));
    await assertFails(deleteDoc(doc(superDb, "events/legacy/access/participants")));
    await assertFails(updateDoc(doc(superDb, "events/legacy"), { accessVersion: 0 }));
    await assertFails(updateDoc(doc(org, "events/legacy"), { judgeEmails: ["mate@tec.mx"] }));
    await assertSucceeds(updateDoc(doc(mate, "events/legacy/projects/old"), { title: "Proyecto conservado" }));
  });

  test("no se elimina un evento dejando integrantes o reiniciando su índice", async () => {
    await assertFails(deleteDoc(doc(org, "events/e1")));
    const unsafe = writeBatch(org);
    unsafe.delete(doc(org, "events/e1/access/participants"));
    unsafe.delete(doc(org, "events/e1"));
    await assertFails(unsafe.commit());
    await assertSucceeds(createEvent(org, "empty", eventFor("org", "org@tec.mx")));
    const batch = writeBatch(org);
    batch.delete(doc(org, "events/empty/access/participants"));
    batch.delete(doc(org, "events/empty"));
    await assertSucceeds(batch.commit());
  });
});

describe("huellas anti-plagio", () => {
  const fp = {
    projectId: "p1",
    eventId: "e1",
    eventName: "Expo",
    title: "Proyecto Alfa",
    year: 2026,
    sigPhrases: [1],
    sigWords: [1],
    urls: [],
    fileHashes: [],
    tokenCount: 10,
  };

  test("las escribe un integrante u organizador del evento", async () => {
    await assertSucceeds(setDoc(doc(mate, "fingerprints/p1"), fp));
    await assertFails(setDoc(doc(outsider, "fingerprints/p1"), fp));
    await assertFails(setDoc(doc(mate, "fingerprints/p1"), { ...fp, eventId: "e9" }));
  });

  test("se leen con cuenta verificada y nunca se borran", async () => {
    await assertSucceeds(getDocs(collection(outsider, "fingerprints")));
    await assertFails(deleteDoc(doc(superDb, "fingerprints/p1")));
  });
});

describe("rúbricas por categoría", () => {
  const cartelCriteria = [{ id: "diseno", name: "Diseño visual", description: "", weight: 100 }];
  const prototypeCriteria = [{ id: "funcionamiento", name: "Funcionamiento", description: "", weight: 100 }];
  const eid = "rubricas-categorias";
  const scoreDoc = (projectId, scores) => ({
    eventId: eid, projectId, phase: "prototype", judgeId: "judge", judgeEmail: "judge@tec.mx", judgeName: "Juez",
    scores, total: 80, comment: "Buen trabajo",
  });

  test("un evento guarda dos categorías con sus criterios independientes", async () => {
    const data = { ...eventFor("org", "org@tec.mx"), categories: ["Carteles", "Prototipos"], categoryCriteria: { Carteles: cartelCriteria, Prototipos: prototypeCriteria } };
    await assertSucceeds(createEvent(org, eid, data));
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await setDoc(doc(db, `events/${eid}/projects/cartel`), { ...project, eventId: eid, category: "Carteles" });
      await setDoc(doc(db, `events/${eid}/projects/proto`), { ...project, eventId: eid, category: "Prototipos" });
    });
    await assertSucceeds(updateDoc(doc(org, `events/${eid}`), { judgeEmails: ["judge@tec.mx"], judgingOpen: true, categoryLocked: true }));
    const saved = (await getDoc(doc(judge, `events/${eid}`))).data();
    assert.deepEqual(saved.categoryCriteria.Carteles, cartelCriteria);
    assert.deepEqual(saved.categoryCriteria.Prototipos, prototypeCriteria);
  });

  test("cada proyecto acepta únicamente los criterios de su categoría", async () => {
    const ref = doc(judge, `events/${eid}/evaluations/judge_cartel_prototype`);
    await assertSucceeds(setDoc(ref, scoreDoc("cartel", { diseno: 8 })));
    await assertFails(setDoc(ref, scoreDoc("cartel", { funcionamiento: 8 })));
    await assertSucceeds(setDoc(doc(judge, `events/${eid}/evaluations/judge_proto_prototype`), scoreDoc("proto", { funcionamiento: 8 })));
  });

  test("rechaza criterios vacíos, sobrantes, ausentes o fuera de escala", async () => {
    const ref = doc(judge, `events/${eid}/evaluations/judge_cartel_prototype`);
    for (const scores of [{}, { diseno: 8, funcionamiento: 5 }, { diseno: -1 }, { diseno: 11 }, { diseno: "8" }]) {
      await assertFails(setDoc(ref, scoreDoc("cartel", scores)));
    }
  });

  test("solo organizadores editan rúbricas y los nombres con puntos no crean rutas", async () => {
    const ref = doc(org, `events/${eid}`);
    await assertFails(updateDoc(doc(judge, `events/${eid}`), { categoryCriteria: { Carteles: prototypeCriteria } }));
    await assertSucceeds(updateDoc(ref, new FieldPath("categoryCriteria", "Diseño 2.0 / IoT"), cartelCriteria));
    const saved = (await getDoc(ref)).data();
    assert.deepEqual(saved.categoryCriteria["Diseño 2.0 / IoT"], cartelCriteria);
    assert.deepEqual(saved.categoryCriteria.Prototipos, prototypeCriteria);
    await assertFails(updateDoc(ref, new FieldPath("categoryCriteria", "Carteles"), []));
    await assertFails(updateDoc(ref, { categoryCriteria: [] }));
  });

  test("sin rúbrica personalizada una categoría conserva la general", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), `events/${eid}/projects/legacy`), { ...project, eventId: eid, category: "Sin personalizar" });
    });
    await assertSucceeds(setDoc(doc(judge, `events/${eid}/evaluations/judge_legacy_prototype`), scoreDoc("legacy", { a: 8 })));
  });

  test("la categoría no se cambia después de iniciar la evaluación, incluso al cerrarla", async () => {
    const ref = doc(stu, `events/${eid}/projects/cartel`);
    await assertFails(updateDoc(ref, { category: "Prototipos" }));
    await assertSucceeds(updateDoc(doc(org, `events/${eid}`), { judgingOpen: false }));
    await assertFails(updateDoc(ref, { category: "Prototipos" }));
    await assertFails(updateDoc(doc(org, `events/${eid}`), { categoryLocked: false }));
    await assertSucceeds(updateDoc(ref, { title: "Cartel corregido" }));
  });

  test("admite el máximo de 20 categorías y 20 criterios por rúbrica", async () => {
    const categories = Array.from({ length: 20 }, (_, i) => `Categoría ${i}`);
    const fullCriteria = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, name: `Criterio ${i}`, description: "", weight: 5 }));
    await assertSucceeds(createEvent(org, "rubricas-maximo", {
      ...eventFor("org", "org@tec.mx"), categories,
      categoryCriteria: Object.fromEntries(categories.map((category) => [category, fullCriteria])),
    }));
    await assertSucceeds(updateDoc(doc(org, "events/rubricas-maximo"), new FieldPath("categoryCriteria", categories[0]), fullCriteria.map((c) => ({ ...c, name: `Actualizado ${c.id}` }))));
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "events/rubricas-maximo/projects/pmax"), { ...project, eventId: "rubricas-maximo", category: categories[19] });
    });
    await assertSucceeds(updateDoc(doc(org, "events/rubricas-maximo"), { judgeEmails: ["judge@tec.mx"], judgingOpen: true, categoryLocked: true }));
    await assertSucceeds(setDoc(doc(judge, "events/rubricas-maximo/evaluations/judge_pmax_prototype"), {
      ...scoreDoc("pmax", Object.fromEntries(fullCriteria.map((c) => [c.id, 8]))), eventId: "rubricas-maximo",
    }));
  });
});

describe("alta por correo y formulario inicial del líder", () => {
  const pendingProject = { ...project, title: "", summary: "", problem: "", solution: "", category: "",
    registrationPending: true, members: [{ name: "", email: "stu@tec.mx" }], memberEmails: ["stu@tec.mx"] };
  const completed = { registrationPending: false, title: "Proyecto del alumno", category: "Software",
    summary: "Resumen completo del proyecto escolar", problem: "Problema que atiende el proyecto escolar",
    solution: "Solución que propone el alumno líder", members: [{ name: "Alumno Líder", email: "stu@tec.mx" }], memberEmails: ["stu@tec.mx"] };
  async function seedPending(id, patch = {}) {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `events/${id}`), { ...eventFor("org", "org@tec.mx"), judgeEmails: ["judge@tec.mx"],
        registrationOpen: false, submissions: { prototype: false, final: false }, categories: ["Software", "Hardware"], ...patch });
      await setDoc(doc(db, `events/${id}/projects/pending`), { ...pendingProject, eventId: id });
      await setDoc(doc(db, `events/${id}/access/participants`), { members: { "stu@tec.mx": true }, projectId: "pending" });
    });
  }
  test("el líder ve su alta en Mis proyectos y completa el formulario con registro público cerrado", async () => {
    const id = "pending-completion";
    await seedPending(id);
    const mine = await assertSucceeds(getDocs(query(collectionGroup(stu, "projects"), where("memberEmails", "array-contains", "stu@tec.mx"))));
    assert.ok(mine.docs.some((snapshot) => snapshot.ref.path === `events/${id}/projects/pending`));
    const data = { ...completed, members: [...completed.members, { name: "Alumna Integrante", email: "mate@tec.mx" }], memberEmails: ["stu@tec.mx", "mate@tec.mx"] };
    await assertSucceeds(syncTeam(stu, "pending", data, ["stu@tec.mx"], id));
    await assertSucceeds(getDoc(doc(mate, `events/${id}/projects/pending`)));
    const roster = await getDoc(doc(org, `events/${id}/access/participants`));
    assert.deepEqual(roster.data().members, { "stu@tec.mx": true, "mate@tec.mx": true });
  });
  test("ni organizador ni otro alumno completan el formulario del líder", async () => {
    const id = "pending-owner";
    await seedPending(id);
    for (const actor of [org, admin, mate, outsider]) {
      await assertFails(updateDoc(doc(actor, `events/${id}/projects/pending`), completed));
    }
  });
  test("no se omite el formulario, nombre del líder, categoría ni descripciones", async () => {
    const id = "pending-required";
    await seedPending(id);
    const ref = doc(stu, `events/${id}/projects/pending`);
    for (const patch of [{ registrationPending: false }, { ...completed, summary: "" }, { ...completed, problem: "" },
      { ...completed, solution: "" }, { ...completed, category: "Ajena" },
      { ...completed, members: [{ name: "", email: "stu@tec.mx" }] }, { ...completed, registrationPending: true }]) {
      await assertFails(updateDoc(ref, patch));
    }
  });
  test("el líder no puede autoasignarse el alta pendiente para saltarse el cierre de registro", async () => {
    const id = "pending-forged";
    await seedPending(id);
    await assertFails(syncTeam(outsider, "forged", { ...pendingProject, eventId: id,
      leaderId: "out", leaderEmail: "out@tec.mx", memberEmails: ["out@tec.mx"] }, [], id));
    await assertSucceeds(updateDoc(doc(stu, `events/${id}/projects/pending`), completed));
    await assertFails(updateDoc(doc(stu, `events/${id}/projects/pending`), { registrationPending: true }));
  });
  test("no admite entregas ni evaluaciones de un registro pendiente", async () => {
    const id = "pending-evaluation";
    await seedPending(id, { judgingOpen: true, submissions: { prototype: true, final: true } });
    await assertFails(updateDoc(doc(stu, `events/${id}/projects/pending`), { prototype: { description: "Entrega prematura", files: [], links: [] } }));
    await assertFails(updateDoc(doc(stu, `events/${id}/projects/pending`), { ...completed, prototype: { description: "No junto con el registro" } }));
    await assertFails(setDoc(doc(judge, `events/${id}/evaluations/judge_pending_prototype`), {
      eventId: id, projectId: "pending", phase: "prototype", judgeId: "judge", judgeEmail: "judge@tec.mx", scores: { a: 8 }, total: 80, comment: "Buen trabajo" }));
  });
  test("el formulario inicial respeta categoría bloqueada y resultados publicados", async () => {
    for (const [suffix, patch] of Object.entries({ locked: { categoryLocked: true }, published: { resultsPublished: true } })) {
      const id = `pending-${suffix}`;
      await seedPending(id, patch);
      await assertFails(updateDoc(doc(stu, `events/${id}/projects/pending`), completed));
    }
  });
});


test("una sesión retirada no recrea el perfil ni registra proyectos con su token antiguo", async () => {
  const retired = ctx("retired-student", "retired@tec.mx");
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "withdrawnAccounts/retired-student"), { withdrawnAt: 1 }));
  await assertFails(setDoc(doc(retired, "users/retired-student"), { email: "retired@tec.mx" }));
  await assertFails(syncTeam(retired, "retired", { ...project, leaderId: "retired-student", leaderEmail: "retired@tec.mx", memberEmails: ["retired@tec.mx"] }));
});
