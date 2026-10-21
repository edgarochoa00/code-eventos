// Pruebas de firestore.rules contra el emulador.
// Uso: npm run test:rules
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

const SUPER = "edgarochoa0173@gmail.com";
let env;
const tok = (email, verified = true) => ({ email, email_verified: verified });
const ctx = (uid, email, verified = true) => env.authenticatedContext(uid, tok(email, verified)).firestore();

const criteria = [{ id: "a", name: "A", description: "", weight: 100 }];
const eventFor = (ownerId, ownerEmail) => ({
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
const project = {
  eventId: "e1",
  title: "AquaSense",
  summary: "Riego",
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
    await assertSucceeds(setDoc(doc(org, "events/e1"), eventFor("org", "org@tec.mx")));
    await assertSucceeds(setDoc(doc(superDb, "events/e2"), eventFor("super", SUPER)));
    await assertSucceeds(setDoc(doc(admin, "events/e3"), eventFor("adm", "adm@tec.mx")));
    await assertFails(setDoc(doc(stu, "events/e4"), eventFor("stu", "stu@tec.mx")));
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
  });
});

describe("proyectos", () => {
  test("alumno registra su proyecto", async () => {
    await assertSucceeds(setDoc(doc(stu, "events/e1/projects/p1"), project));
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

  test("lectura: el juez las suyas, organizador y admin todas", async () => {
    await assertSucceeds(getDocs(query(collection(judge, "events/e1/evaluations"), where("judgeId", "==", "judge"))));
    await assertSucceeds(getDocs(collection(org, "events/e1/evaluations")));
    await assertSucceeds(getDocs(collection(admin, "events/e1/evaluations")));
    await assertFails(getDocs(collection(stu, "events/e1/evaluations")));
  });

  test("organizador publica resultados en el proyecto", async () => {
    await assertSucceeds(updateDoc(doc(org, "events/e1/projects/p1"), { feedback: { prototype: { score: 80 } } }));
  });
});

describe("huellas anti-plagio", () => {
  const fp = {
    projectId: "p1",
    eventId: "e1",
    eventName: "Expo",
    title: "AquaSense",
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
