import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { GET } from "../app/api/project-results/route";
import { adminServices } from "../lib/server/firebase-admin";

assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, "Ejecuta npm run test:team-results");
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-code";
process.env.NEXT_PUBLIC_USE_EMULATORS = "true";

const { auth, db } = adminServices();
const prefix = `team-results-${Date.now()}`;
const email = (name: string) => `${prefix}-${name}@example.test`;
const event = db.doc(`events/${prefix}`);
const tokens = new Map<string, string>();
const users: string[] = [];

before(async () => {
  const password = "ExamplePass123!";
  for (const name of ["leader", "member", "other-team", "judge", "blocked", "unverified"]) {
    const user = await auth.createUser({ email: email(name), password, emailVerified: name !== "unverified" });
    users.push(user.uid);
    const session = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email(name), password, returnSecureToken: true }),
    });
    assert.equal(session.status, 200);
    tokens.set(name, (await session.json()).idToken);
  }

  const batch = db.batch();
  batch.set(event, {
    phases: { prototype: true, final: true }, resultsPublished: false, organizerEmails: [email("org")], judgeEmails: [email("judge")],
    criteria: [{ id: "design", name: "Diseño", description: "", weight: 100 }],
  });
  batch.set(event.collection("projects").doc("own"), {
    title: "Proyecto del equipo", category: "Cartel", leaderEmail: email("leader"),
    memberEmails: ["leader", "member", "blocked", "unverified"].map(email),
  });
  batch.set(event.collection("projects").doc("other"), { title: "Proyecto ajeno", category: "Cartel", memberEmails: [email("other-team")] });
  batch.set(db.doc(`staff/${email("blocked")}`), { role: "blocked" });
  for (const [projectId, phase, judgeId, score, comment] of [
    ["own", "prototype", "j1", 8, "Usen más ejemplos."],
    ["own", "prototype", "j2", 9.5, "Claridad en el diseño."],
    ["own", "final", "j1", 10, "Comentario que revelaría al único evaluador."],
    ["other", "prototype", "j1", 7, "Comentario privado de otro equipo."],
  ] as const) {
    batch.set(event.collection("evaluations").doc(`${projectId}_${phase}_${judgeId}`), {
      projectId, phase, judgeId, judgeEmail: email("judge"), judgeName: `Evaluador falso ${judgeId}`,
      scores: { design: score }, total: 0, comment,
    });
  }
  await batch.commit();
});

after(async () => {
  await Promise.all([
    db.recursiveDelete(event), db.doc(`staff/${email("blocked")}`).delete(),
    ...users.map((uid) => auth.deleteUser(uid)),
  ]);
});

function request(name?: string, projectId = "own") {
  const headers = name ? { Authorization: `Bearer ${tokens.get(name)}` } : undefined;
  const query = new URLSearchParams({ eventId: event.id, projectId });
  return GET(new Request(`http://localhost/api/project-results?${query}`, { headers }));
}

test("cada integrante solo puede leer el promedio y comentarios de su proyecto al publicar", async () => {
  assert.equal((await request()).status, 401);
  assert.equal((await request("leader")).status, 404);
  await event.update({ resultsPublished: true });

  for (const name of ["leader", "member"]) {
    const response = await request(name);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), {
      results: [{ phase: "prototype", score: 87.5, comments: ["Claridad en el diseño.", "Usen más ejemplos."] }],
    });
  }
  assert.equal((await request("leader", "other")).status, 403);
  for (const name of ["other-team", "judge", "blocked", "unverified"]) {
    assert.equal((await request(name)).status, 403, name);
  }

  await event.update({ resultsPublished: false });
  assert.equal((await request("member")).status, 404);
});
