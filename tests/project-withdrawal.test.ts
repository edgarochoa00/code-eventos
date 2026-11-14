import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { POST } from "../app/api/project-withdrawal/route";
import { adminServices } from "../lib/server/firebase-admin";

assert.ok(process.env.FIRESTORE_EMULATOR_HOST);
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST);
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-code";
process.env.NEXT_PUBLIC_USE_EMULATORS = "true";
const { auth, db } = adminServices();
const prefix = `withdraw-${Date.now()}`;
const email = (id: string) => `${prefix}-${id}@example.com`;
const users: string[] = [];
const events: string[] = [];
let orgToken: string;
let count = 0;
async function account(id: string) {
  const user = await auth.createUser({ email: email(id), password: "EmulatorOnly!123", emailVerified: true });
  users.push(user.uid);
  await db.doc(`users/${user.uid}`).set({ uid: user.uid, email: user.email, displayName: id });
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, password: "EmulatorOnly!123", returnSecureToken: true }),
  });
  return { user, token: (await response.json()).idToken as string };
}
async function fixture() {
  const id = `${prefix}-${++count}`;
  const leader = await account(`leader-${count}`);
  const member = await account(`member-${count}`);
  events.push(id);
  await db.doc(`events/${id}`).set({ accessVersion: 1, organizerEmails: [email("org")], judgeEmails: [], registrationOpen: true, resultsPublished: false });
  await db.doc(`events/${id}/projects/p`).set({ eventId: id, leaderId: leader.user.uid, leaderEmail: leader.user.email,
    memberEmails: [leader.user.email, member.user.email] });
  await db.doc(`events/${id}/access/participants`).set({ members: { [leader.user.email!]: true, [member.user.email!]: true }, projectId: "p" });
  return { id, leader, member };
}
async function send(id: string, token = orgToken) {
  const response = await POST(new Request("http://localhost/api/project-withdrawal", { method: "POST",
    headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ eventId: id, projectId: "p" }) }));
  return { status: response.status, data: await response.json() };
}
before(async () => { orgToken = (await account("org")).token; });
after(async () => {
  for (const id of events) {
    await db.recursiveDelete(db.doc(`events/${id}`));
    await db.doc(`projectWithdrawals/${id}_p`).delete();
  }
  for (const uid of users) {
    await auth.deleteUser(uid).catch(() => undefined);
    await db.doc(`users/${uid}`).delete();
    await db.doc(`withdrawnAccounts/${uid}`).delete();
  }
});
test("la baja elimina proyecto, reserva, perfiles y Auth; el correo puede registrarse otra vez", async () => {
  const f = await fixture();
  assert.equal((await send(f.id)).status, 200);
  assert.equal((await db.doc(`events/${f.id}/projects/p`).get()).exists, false);
  assert.deepEqual((await db.doc(`events/${f.id}/access/participants`).get()).data()?.members, {});
  for (const user of [f.leader.user, f.member.user]) {
    assert.equal((await db.doc(`users/${user.uid}`).get()).exists, false);
    await assert.rejects(auth.getUser(user.uid), { code: "auth/user-not-found" });
    const replacement = await auth.createUser({ email: user.email });
    users.push(replacement.uid);
    assert.notEqual(replacement.uid, user.uid);
  }
  assert.equal((await send(f.id)).status, 200); // Reintento no borra las cuentas nuevas.
  assert.ok(await auth.getUserByEmail(f.leader.user.email!));
});
test("el líder puede dar de baja su proyecto y su sesión debe cerrarse", async () => {
  const f = await fixture();
  assert.deepEqual(await send(f.id, f.leader.token), { status: 200, data: { deleted: true, accountDeleted: true } });
});
test("un integrante o usuario ajeno no puede borrar el proyecto ni cuentas", async () => {
  const f = await fixture();
  assert.equal((await send(f.id, f.member.token)).status, 403);
  assert.equal((await send(f.id, "invalid")).status, 401);
  assert.equal((await db.doc(`events/${f.id}/projects/p`).get()).exists, true);
  assert.ok(await auth.getUser(f.leader.user.uid));
});
test("conserva cuenta y perfil de integrantes que participan en otro evento", async () => {
  const f = await fixture();
  const other = `${f.id}-other`;
  events.push(other);
  await db.doc(`events/${other}`).set({ organizerEmails: [], judgeEmails: [] });
  await db.doc(`events/${other}/projects/other`).set({ memberEmails: [f.member.user.email] });
  assert.equal((await send(f.id)).status, 200);
  assert.ok(await auth.getUser(f.member.user.uid));
  assert.equal((await db.doc(`users/${f.member.user.uid}`).get()).exists, true);
  await assert.rejects(auth.getUser(f.leader.user.uid), { code: "auth/user-not-found" });
});
test("conserva accesos de jueces y organizadores de otros eventos", async () => {
  const f = await fixture();
  const other = `${f.id}-roles`;
  events.push(other);
  await db.doc(`events/${other}`).set({ organizerEmails: [f.leader.user.email], judgeEmails: [f.member.user.email] });
  assert.equal((await send(f.id)).status, 200);
  for (const user of [f.leader.user, f.member.user]) assert.ok(await auth.getUser(user.uid));
});
test("no permite la baja con resultados publicados ni al líder con registro cerrado", async () => {
  const f = await fixture();
  await db.doc(`events/${f.id}`).update({ registrationOpen: false });
  assert.equal((await send(f.id, f.leader.token)).status, 409);
  await db.doc(`events/${f.id}`).update({ resultsPublished: true });
  assert.equal((await send(f.id)).status, 409);
  assert.ok(await auth.getUser(f.leader.user.uid));
});

test("un fallo de Authentication permite reintentar sin dejar un correo bloqueado", async () => {
  const f = await fixture();
  const original = auth.deleteUser.bind(auth);
  const failure = mock.method(auth, "deleteUser", async (uid: string) => {
    if (uid === f.member.user.uid) throw new Error("Fallo temporal simulado");
    return original(uid);
  });
  try {
    assert.equal((await send(f.id)).status, 503);
    assert.equal((await db.doc(`projectWithdrawals/${f.id}_p`).get()).data()?.completed, false);
  } finally { failure.mock.restore(); }
  assert.equal((await send(f.id)).status, 200);
  await assert.rejects(auth.getUserByEmail(f.member.user.email!), { code: "auth/user-not-found" });
});
