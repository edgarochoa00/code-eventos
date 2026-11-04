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
  env = await initializeTestEnvironment({
    projectId: "demo-code",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 },
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
    await assertSucceeds(updateDoc(doc(superDb, "events/e2"), { judgingOpen: true }));
    await assertSucceeds(setDoc(doc(org, "events/e2/evaluations/org_cross-event_prototype"), {
      eventId: "e2", projectId: "cross-event", phase: "prototype", judgeId: "org", judgeEmail: "org@tec.mx", judgeName: "", scores: { a: 8 }, total: 80, comment: "",
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
      await updateDoc(doc(c.firestore(), "events/e1"), { judgeEmails: ["judge@tec.mx", "mate@tec.mx"], judgingOpen: true });
    });
    await assertFails(getDoc(doc(mate, "events/e1/projects/legacy-conflict")));
    await assertFails(updateDoc(doc(mate, "events/e1/projects/p1"), { title: "Juez competidor" }));
    await assertFails(setDoc(doc(mate, "events/e1/evaluations/mate_legacy-conflict_prototype"), {
      eventId: "e1", projectId: "legacy-conflict", phase: "prototype", judgeId: "mate", judgeEmail: "mate@tec.mx", judgeName: "", scores: { a: 8 }, total: 80, comment: "",
    }));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeEmails: ["judge@tec.mx"], judgingOpen: false }));
    await assertSucceeds(syncTeam(outsider, "legacy-conflict", null, other.memberEmails));
  });

  test("el organizador no edita el contenido del proyecto", async () => {
    await assertFails(updateDoc(doc(org, "events/e1/projects/p1"), { title: "Cambiado por organizador" }));
    await assertFails(
      updateDoc(doc(org, "events/e1/projects/p1"), { feedback: { prototype: {} }, title: "Cambiado por organizador" }),
    );
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
    comment: "",
  };

  test("el juez solo califica con la evaluación abierta", async () => {
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), evalDoc));
    await updateDoc(doc(org, "events/e1"), { judgingOpen: true });
    await assertSucceeds(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), evalDoc));
  });

  test("validaciones de la evaluación", async () => {
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/other_p1_prototype"), evalDoc));
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_prototype"), { ...evalDoc, total: 150 }));
    await assertFails(
      setDoc(doc(stu, "events/e1/evaluations/stu_p1_prototype"), { ...evalDoc, judgeId: "stu", judgeEmail: "stu@tec.mx" }),
    );
  });

  test("la asignación limita las escrituras por categoría o proyecto y admite listas vacías", async () => {
    const ref = doc(judge, "events/e1/evaluations/judge_p1_prototype");
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeAssignments: { "judge@tec.mx": { categories: ["Hardware"] } } }));
    await assertFails(setDoc(ref, evalDoc));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeAssignments: { "judge@tec.mx": { categories: ["Hardware"], projectIds: ["p1"] } } }));
    await assertSucceeds(setDoc(ref, evalDoc));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeAssignments: { "judge@tec.mx": { categories: ["Software"] } } }));
    await assertSucceeds(setDoc(ref, evalDoc));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { judgeAssignments: { "judge@tec.mx": { categories: [], projectIds: [] } } }));
    await assertSucceeds(setDoc(ref, evalDoc));
  });

  test("no se califican etapas deshabilitadas", async () => {
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { phases: { prototype: true, final: false } }));
    await assertFails(setDoc(doc(judge, "events/e1/evaluations/judge_p1_final"), { ...evalDoc, phase: "final" }));
    await assertSucceeds(updateDoc(doc(org, "events/e1"), { phases: { prototype: true, final: true } }));
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
