import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { POST } from "../app/api/team-enrollment/route";
import { adminServices } from "../lib/server/firebase-admin";
import type { TeamEnrollmentInput } from "../lib/team-enrollment";

// Esta suite necesita ambos emuladores y nunca utiliza credenciales de producción.
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "Ejecuta npm run test:enrollment");
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, "Falta el emulador de Auth");
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-code";
process.env.NEXT_PUBLIC_USE_EMULATORS = "true";
const { auth, db } = adminServices();
const prefix = `enroll-${Date.now()}`;
const email = (id: string) => `${prefix}-${id}@example.com`;
const eventId = `${prefix}-event`;
const orgEmail = email("org");
const password = "Existing!Password123";
let orgToken: string, adminToken: string;
let sequence = 0;
const createdEvents = new Set<string>();

async function login(address: string, pass = password) {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: address, password: pass, returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).idToken as string;
}
async function account(id: string, verified = true) {
  const user = await auth.createUser({ email: email(id), displayName: `Original ${id}`, password, emailVerified: verified });
  return { user, token: await login(email(id)) };
}
async function seedEvent(id = eventId, patch = {}) {
  createdEvents.add(id);
  await db.doc(`events/${id}`).set({ accessVersion: 1, name: "Evento de altas", ownerEmail: orgEmail, ownerId: "org",
    organizerEmails: [orgEmail, email("coorg")], judgeEmails: [email("judge")], maxTeamSize: 3,
    categories: ["Carteles", "Prototipos"], categoryLocked: false, judgingOpen: false, registrationOpen: true,
    phases: { prototype: true, final: true }, submissions: { prototype: true, final: true }, resultsPublished: false, ...patch });
  await db.doc(`events/${id}/access/participants`).set({ members: {}, projectId: "" });
}
function input(patch: Partial<TeamEnrollmentInput> = {}): TeamEnrollmentInput {
  return { eventId, email: email(`leader-${++sequence}`), ...patch };
}
async function send(data: unknown, token = orgToken) {
  const response = await POST(new Request("http://localhost/api/team-enrollment", {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data),
  }));
  return { status: response.status, data: await response.json(), cache: response.headers.get("cache-control") };
}

before(async () => {
  orgToken = (await account("org")).token;
  adminToken = (await account("admin")).token;
  await db.doc(`staff/${email("admin")}`).set({ role: "admin" });
  await seedEvent();
});
after(async () => {
  for (const id of createdEvents) await db.recursiveDelete(db.doc(`events/${id}`));
  const users = await auth.listUsers(1000);
  for (const user of users.users.filter((item) => item.email?.startsWith(prefix))) {
    await db.doc(`users/${user.uid}`).delete();
    await db.doc(`staff/${user.email}`).delete();
    await auth.deleteUser(user.uid);
  }
});

test("sesión ausente, inválida o sin verificar no puede crear cuentas", async () => {
  const data = input();
  assert.equal((await send(data, "")).status, 401);
  assert.equal((await send(data, "invalid")).status, 401);
  const unverified = await account("unverified", false);
  assert.equal((await send(data, unverified.token)).status, 403);
  await assert.rejects(auth.getUserByEmail(data.email), { code: "auth/user-not-found" });
});

test("alumno, juez, suspendido y organizador de otro evento quedan fuera", async () => {
  for (const id of ["student", "judge", "blocked", "other-org"]) {
    const user = await account(id);
    if (id === "blocked" || id === "other-org") await db.doc(`staff/${email(id)}`).set({ role: id === "blocked" ? "blocked" : "organizer" });
    const data = input();
    assert.equal((await send(data, user.token)).status, 403, id);
    await assert.rejects(auth.getUserByEmail(data.email), { code: "auth/user-not-found" });
  }
});

test("el organizador da de alta solo el correo y deja proyecto, categoría e integrantes para el líder", async () => {
  const data = input();
  const result = await send({ ...data, email: ` ${data.email.toUpperCase()} ` });
  assert.equal(result.status, 200);
  assert.equal(result.cache, "no-store");
  assert.equal(result.data.createdAccounts.length, 1);
  const project = (await db.doc(`events/${eventId}/projects/${result.data.projectId}`).get()).data()!;
  const user = await auth.getUserByEmail(data.email);
  assert.equal(project.registrationPending, true);
  assert.equal(project.leaderEmail, data.email);
  assert.equal(project.leaderId, user.uid);
  for (const field of ["title", "category", "summary", "problem", "solution"]) assert.equal(project[field], "");
  assert.deepEqual(project.members, [{ name: "", email: data.email }]);
  assert.deepEqual(project.memberEmails, [data.email]);
  assert.equal(project.prototype, null);
  assert.equal(project.final, null);
  assert.equal(user.emailVerified, false);
  assert.equal((await db.doc(`events/${eventId}/access/participants`).get()).data()?.members[data.email], true);
  assert.equal((await db.doc(`users/${user.uid}`).get()).data()?.lastLoginAt, null);
  assert.equal((await db.doc(`fingerprints/${result.data.projectId}`).get()).exists, false);
  await login(data.email, result.data.createdAccounts[0].password);
});

test("admin reutiliza cuenta, perfil y contraseña en distintos eventos", async () => {
  const existing = await account("existing");
  await db.doc(`users/${existing.user.uid}`).set({ displayName: "Nombre personal", lastLoginAt: "conservar" });
  const first = await send(input({ email: existing.user.email! }), adminToken);
  assert.equal(first.status, 200);
  assert.deepEqual(first.data.createdAccounts, []);
  const secondEvent = `${prefix}-second`;
  await seedEvent(secondEvent);
  const second = await send(input({ eventId: secondEvent, email: existing.user.email! }), adminToken);
  assert.equal(second.status, 200);
  const project = (await db.doc(`events/${secondEvent}/projects/${second.data.projectId}`).get()).data()!;
  assert.equal(project.leaderId, existing.user.uid);
  assert.equal(project.registrationPending, true);
  assert.equal(project.members[0].name, existing.user.displayName);
  assert.equal((await db.doc(`users/${existing.user.uid}`).get()).data()?.displayName, "Nombre personal");
  await login(existing.user.email!);
});

test("coorganizadores pueden registrar correos en su evento", async () => {
  const coorg = await account("coorg");
  assert.equal((await send(input(), coorg.token)).status, 200);
});

test("un correo ya registrado no se duplica ni modifica su proyecto", async () => {
  const data = input();
  const created = await send(data);
  const ref = db.doc(`events/${eventId}/projects/${created.data.projectId}`);
  await ref.update({ title: "Contenido del alumno", summary: "Conservar", registrationPending: false });
  const before = (await ref.get()).data();
  assert.equal((await send(data)).status, 409);
  assert.deepEqual((await ref.get()).data(), before);
});

test("roles incompatibles se rechazan antes de crear cuentas", async () => {
  for (const address of [orgEmail, email("admin"), email("judge"), email("blocked"), "edgarochoa0173@gmail.com"]) {
    assert.equal((await send(input({ email: address }))).status, 409);
  }
});

test("solo admite evento y correo; los datos del proyecto e integrantes los completa el alumno", async () => {
  for (const data of [input({ email: "correo/sin@dominio.com" }), input({ email: "invalido" }),
    { ...input(), title: "No corresponde al organizador" }, { ...input(), category: "Carteles" },
    { ...input(), members: [] }, { ...input(), projectId: "otro" }]) {
    assert.equal((await send(data)).status, 400);
  }
});

test("rechaza resultados publicados, evaluación iniciada y eventos sin permisos actualizados", async () => {
  for (const [key, patch] of Object.entries({ published: { resultsPublished: true }, judging: { judgingOpen: true },
    locked: { categoryLocked: true }, legacy: { accessVersion: 0 } })) {
    const id = `${prefix}-${key}`;
    await seedEvent(id, patch);
    const data = input({ eventId: id });
    assert.equal((await send(data)).status, 409);
    await assert.rejects(auth.getUserByEmail(data.email), { code: "auth/user-not-found" });
  }
});

test("el responsable puede dar de alta al líder con el registro público cerrado", async () => {
  const id = `${prefix}-closed`;
  await seedEvent(id, { registrationOpen: false, submissions: { prototype: false, final: false } });
  assert.equal((await send(input({ eventId: id }))).status, 200);
});

test("dos altas concurrentes del mismo correo no duplican al líder", async () => {
  const data = input();
  const results = await Promise.all([send(data), send(data)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const projects = await db.collection(`events/${eventId}/projects`).where("leaderEmail", "==", data.email).get();
  assert.equal(projects.size, 1);
  const credentials = results.flatMap((result) => result.data.createdAccounts);
  assert.equal(credentials.length, 1);
  await login(data.email, credentials[0].password);
});

test("cuentas deshabilitadas fallan sin registrar al líder", async () => {
  const disabled = await account("disabled");
  await auth.updateUser(disabled.user.uid, { disabled: true });
  const data = input({ email: disabled.user.email! });
  const result = await send(data);
  assert.equal(result.status, 409);
  assert.deepEqual(result.data.createdAccounts, []);
  assert.equal((await db.collection(`events/${eventId}/projects`).where("leaderEmail", "==", data.email).get()).size, 0);
});
