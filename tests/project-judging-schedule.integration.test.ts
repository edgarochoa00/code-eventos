import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { terminate } from "firebase/firestore";

// Solo emuladores: nunca usa .env.local ni credenciales de producción.
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "Ejecuta esta suite con los emuladores de Auth y Firestore.");
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, "Falta el emulador de Auth.");
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-code";
process.env.NEXT_PUBLIC_USE_EMULATORS = "true";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "fake-key";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo-code.appspot.com";
describe("Turnos por proyecto con Auth y Firestore locales", async () => {
  const { adminServices } = await import("../lib/server/firebase-admin");
  const admin = adminServices();
  const { auth, db } = await import("../lib/firebase");
  const { saveProjectJudgeSchedule } = await import("../lib/data");
  const prefix = `project-turn-${Date.now()}`;
  const organizer = `${prefix}-org@example.com`;
  const judges = [1, 2, 3].map(n => `${prefix}-judge${n}@example.com`);
  const password = "Local!Password123";
  const slot = { startsAt: "2026-11-18T17:00:00.000Z", endsAt: "2026-11-18T17:20:00.000Z" };
  const later = { startsAt: slot.endsAt, endsAt: "2026-11-18T17:40:00.000Z" };
  const ref = admin.db.doc(`events/${prefix}`);
  const users: string[] = [];

  async function seed() {
    await ref.set({ accessVersion: 1, name: "Prueba local", ownerId: "org", ownerEmail: organizer,
      organizerEmails: [organizer], judgeEmails: judges, judgeAssignments: {}, maxTeamSize: 3,
      criteria: [{ id: "a", name: "Calidad", description: "", weight: 100 }],
      phases: { prototype: false, final: true }, resultsPublished: false });
    await ref.collection("access").doc("participants").set({ members: {}, projectId: "" });
    for (const pid of ["p1", "p2"]) await ref.collection("projects").doc(pid).set({
      eventId: prefix, title: pid, category: "Software", memberEmails: [],
      judging: { maxJudges: 3, judgeEmails: judges },
    });
  }

  before(async () => {
    for (const email of [organizer, judges[0]]) {
      const user = await admin.auth.createUser({ email, password, emailVerified: true });
      users.push(user.uid);
    }
    await seed();
    await signInWithEmailAndPassword(auth, organizer, password);
  });
  after(async () => {
    await signOut(auth);
    await terminate(db);
    await admin.db.recursiveDelete(ref);
    for (const uid of users) await admin.auth.deleteUser(uid);
  });

  test("la transacción real guarda y retira un turno para tres jueces con las reglas actuales", async () => {
    await saveProjectJudgeSchedule(prefix, "p1", slot, judges);
    let assignments = (await ref.get()).data()!.judgeAssignments;
    for (const email of judges) assert.deepEqual(assignments[email].schedule.p1, slot);
    await saveProjectJudgeSchedule(prefix, "p1", null, judges);
    assignments = (await ref.get()).data()!.judgeAssignments;
    for (const email of judges) assert.equal(assignments[email].schedule.p1, undefined);
  });

  test("dos guardados simultáneos de proyectos distintos conservan ambos turnos", async () => {
    await seed();
    await Promise.all([
      saveProjectJudgeSchedule(prefix, "p1", slot, judges),
      saveProjectJudgeSchedule(prefix, "p2", later, judges),
    ]);
    const assignments = (await ref.get()).data()!.judgeAssignments;
    for (const email of judges) {
      assert.deepEqual(assignments[email].schedule.p1, slot);
      assert.deepEqual(assignments[email].schedule.p2, later);
    }
  });

  test("un cruce concurrente ya guardado impide cualquier cambio parcial del grupo", async () => {
    await seed();
    await ref.update({ judgeAssignments: { [judges[2]]: { schedule: { p2: slot } } } });
    const before = (await ref.get()).data()!.judgeAssignments;
    await assert.rejects(saveProjectJudgeSchedule(prefix, "p1", slot, judges), /se cruza/);
    assert.deepEqual((await ref.get()).data()!.judgeAssignments, before);
  });

  test("relee la selección de jueces y los resultados publicados antes de escribir", async () => {
    await seed();
    await ref.collection("projects").doc("p1").update({ "judging.judgeEmails": judges.slice(0, 2) });
    await assert.rejects(saveProjectJudgeSchedule(prefix, "p1", slot, judges), /asignados cambiaron/);
    assert.deepEqual((await ref.get()).data()!.judgeAssignments, {});
    await seed();
    await ref.update({ resultsPublished: true });
    await assert.rejects(saveProjectJudgeSchedule(prefix, "p1", slot, judges), /no se pueden cambiar/);
  });

  test("las reglas impiden que un juez cambie el turno del grupo", async () => {
    await seed();
    await signInWithEmailAndPassword(auth, judges[0], password);
    try {
      await assert.rejects(saveProjectJudgeSchedule(prefix, "p1", slot, judges), { code: "permission-denied" });
      assert.deepEqual((await ref.get()).data()!.judgeAssignments, {});
    } finally { await signInWithEmailAndPassword(auth, organizer, password); }
  });
});
