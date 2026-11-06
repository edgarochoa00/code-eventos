import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import { POST } from "../app/api/account-invitations/route";
import { adminServices } from "../lib/server/firebase-admin";
import { invitationDeliveryId } from "../lib/server/account-invitations";
import { SUPERADMIN_EMAIL } from "../lib/types";

assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, "Ejecuta npm run test:invitations");
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "Falta el emulador de Firestore");
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-code";
process.env.NEXT_PUBLIC_USE_EMULATORS = "true";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "fake-key";
const { auth, db } = adminServices();
const prefix = `invite-${Date.now()}`;
const email = (id: string) => `${prefix}-${id}@example.com`;
const eventId = `${prefix}-event`;
const org = email("org");
const password = "Existing!Password123";
const emulatorOrigin = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
let orgToken: string, adminToken: string, superToken: string, orgId: string;
let sequence = 0;

async function login(address: string, pass = password) {
  const r = await fetch(`${emulatorOrigin}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: address, password: pass, returnSecureToken: true }),
  });
  assert.equal(r.status, 200);
  return (await r.json()).idToken as string;
}
async function account(id: string, verified = true) {
  const user = await auth.createUser({ email: email(id), password, emailVerified: verified, displayName: `Nombre ${id}` });
  return { user, token: await login(email(id)) };
}
async function target(role: "judge" | "organizer" = "judge") {
  const address = email(`target-${++sequence}`);
  const field = role === "judge" ? "judgeEmails" : "organizerEmails";
  const event = (await db.doc(`events/${eventId}`).get()).data()!;
  await db.doc(`events/${eventId}`).update({ [field]: [...event[field], address] });
  return { kind: "event" as const, eventId, role, email: address };
}
async function send(input: unknown, token = orgToken) {
  const response = await POST(new Request("http://localhost/api/account-invitations", {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(input),
  }));
  return { status: response.status, data: await response.json(), cache: response.headers.get("cache-control") };
}
async function oobCodes(address: string) {
  const r = await fetch(`${emulatorOrigin}/emulator/v1/projects/demo-code/oobCodes`);
  assert.equal(r.status, 200);
  return (await r.json()).oobCodes.filter((item: { email: string }) => item.email === address) as {
    oobCode: string; oobLink: string; requestType: string;
  }[];
}
const receipt = (address: string) => db.doc(`accountInvitationDeliveries/${invitationDeliveryId(address)}`);

before(async () => {
  const organizer = await account("org");
  orgToken = organizer.token; orgId = organizer.user.uid;
  const admin = await account("admin"); adminToken = admin.token;
  await db.doc(`staff/${email("admin")}`).set({ role: "admin" });
  await auth.createUser({ email: SUPERADMIN_EMAIL, password, emailVerified: true });
  superToken = await login(SUPERADMIN_EMAIL);
  await db.doc(`events/${eventId}`).set({ ownerEmail: org, organizerEmails: [org], judgeEmails: [], accessVersion: 1 });
  await db.doc(`events/${eventId}/access/participants`).set({ members: {}, projectId: "" });
});
after(async () => {
  await db.recursiveDelete(db.doc(`events/${eventId}`));
  const users = await auth.listUsers(1000);
  for (const user of users.users.filter((item) => item.email?.startsWith(prefix) || item.email === SUPERADMIN_EMAIL)) {
    await db.doc(`users/${user.uid}`).delete();
    await db.doc(`staff/${user.email}`).delete();
    await db.doc(`accountInvitationLimits/${user.uid}`).delete();
    await receipt(user.email!).delete();
    await auth.deleteUser(user.uid);
  }
});

test("sin sesión, con token inválido o sin correo verificado no crea cuentas ni envía correos", async () => {
  const input = await target();
  assert.equal((await send(input, "")).status, 401);
  assert.equal((await send(input, "invalid")).status, 401);
  const unverified = await account("unverified", false);
  assert.equal((await send(input, unverified.token)).status, 403);
  await assert.rejects(auth.getUserByEmail(input.email), { code: "auth/user-not-found" });
  assert.equal((await oobCodes(input.email)).length, 0);
});

test("alumno, juez, suspendido y organizador de otro evento no pueden enviar accesos", async () => {
  for (const name of ["student", "judge", "blocked", "other-org"]) {
    const user = await account(name);
    if (name === "blocked" || name === "other-org") await db.doc(`staff/${email(name)}`).set({ role: name === "blocked" ? "blocked" : "organizer" });
    const input = await target();
    assert.equal((await send(input, user.token)).status, 403, name);
    await assert.rejects(auth.getUserByEmail(input.email), { code: "auth/user-not-found" });
    assert.equal((await oobCodes(input.email)).length, 0);
  }
});

test("rechaza permisos no asignados, eventos ajenos y URLs o campos suministrados por el cliente", async () => {
  const input = await target();
  for (const patch of [{ email: email("not-assigned") }, { role: "organizer" }, { eventId: "no-existe" }]) {
    assert.ok([403, 409].includes((await send({ ...input, ...patch })).status));
  }
  for (const patch of [{ continueUrl: "https://example.com" }, { role: "superadmin" }, { email: "correo/sin@dominio.com" }, { email: "invalido" }, { kind: "staff", eventId }]) {
    assert.equal((await send({ ...input, ...patch })).status, 400);
  }
  await assert.rejects(auth.getUserByEmail(input.email), { code: "auth/user-not-found" });
});

test("un juez nuevo recibe un enlace: elige contraseña, verifica el correo y conserva su rol", async () => {
  const input = await target();
  const result = await send({ ...input, email: ` ${input.email.toUpperCase()} ` });
  assert.equal(result.status, 200);
  assert.equal(result.cache, "no-store");
  assert.deepEqual(result.data, { status: "sent" });
  const user = await auth.getUserByEmail(input.email);
  assert.equal(user.emailVerified, false);
  const codes = await oobCodes(input.email);
  assert.equal(codes.length, 1);
  assert.equal(codes[0].requestType, "PASSWORD_RESET");
  assert.equal(new URL(codes[0].oobLink).searchParams.get("continueUrl"), "https://feria2026.web.app/login");
  const chosen = "Elegida!PorElJuez2026";
  const response = await fetch(`${emulatorOrigin}/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=fake-key`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oobCode: codes[0].oobCode, newPassword: chosen }),
  });
  assert.equal(response.status, 200);
  const token = await login(input.email, chosen);
  const identity = await auth.verifyIdToken(token);
  assert.equal(identity.uid, user.uid);
  assert.equal(identity.email_verified, true);
  assert.ok((await db.doc(`events/${eventId}`).get()).data()?.judgeEmails.includes(input.email));
  assert.equal((await db.doc(`staff/${input.email}`).get()).exists, false);
  // El código solo se puede usar una vez.
  const reused = await fetch(`${emulatorOrigin}/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=fake-key`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oobCode: codes[0].oobCode, newPassword: chosen }),
  });
  assert.equal(reused.status, 400);
});

test("admin y coorganizador envían acceso a organizadores de su evento", async () => {
  const input = await target("organizer");
  assert.equal((await send(input, adminToken)).status, 200);
  const coorg = await account("coorg");
  const event = (await db.doc(`events/${eventId}`).get()).data()!;
  await db.doc(`events/${eventId}`).update({ organizerEmails: [...event.organizerEmails, coorg.user.email] });
  assert.equal((await send(await target(), coorg.token)).status, 200);
});

test("una cuenta existente conserva contraseña, perfil y verificación al enviarle acceso", async () => {
  const input = await target();
  const user = await auth.createUser({ email: input.email, password, displayName: "Conservar nombre", emailVerified: true });
  await db.doc(`users/${user.uid}`).set({ displayName: "Perfil personal", lastLoginAt: "conservar" });
  assert.equal((await send(input)).status, 200);
  const after = await auth.getUserByEmail(input.email);
  assert.equal(after.uid, user.uid);
  assert.equal(after.displayName, "Conservar nombre");
  assert.equal(after.emailVerified, true);
  assert.deepEqual((await db.doc(`users/${user.uid}`).get()).data(), { displayName: "Perfil personal", lastLoginAt: "conservar" });
  await login(input.email);
});

test("reintentos y envíos concurrentes no duplican correos; permite reenviar después de un minuto", async () => {
  const input = await target();
  const results = await Promise.all([send(input), send(input)]);
  assert.ok(results.some((result) => result.status === 200));
  assert.ok(results.every((result) => result.status === 200 || result.status === 429));
  assert.equal((await oobCodes(input.email)).length, 1);
  assert.deepEqual((await send(input)).data, { status: "recently-sent" });
  assert.equal((await oobCodes(input.email)).length, 1);
  await receipt(input.email).update({ lastAttemptAt: Date.now() - 61_000 });
  assert.equal((await send(input)).status, 200);
  assert.equal((await oobCodes(input.email)).length, 2);
});

test("un fallo de entrega conserva la cuenta y el rol y permite reintentar sin falsear el éxito", async () => {
  const input = await target();
  const originalFetch = globalThis.fetch;
  const mocked = mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("accounts:sendOobCode")) return Response.json({ error: { message: "UNAVAILABLE" } }, { status: 503 });
    return originalFetch(url, init);
  });
  let result;
  try { result = await send(input); } finally { mocked.mock.restore(); }
  assert.equal(result.status, 502);
  assert.equal(result.data.status, undefined);
  const user = await auth.getUserByEmail(input.email);
  assert.ok((await db.doc(`events/${eventId}`).get()).data()?.judgeEmails.includes(input.email));
  assert.equal((await oobCodes(input.email)).length, 0);
  await receipt(input.email).update({ lastAttemptAt: Date.now() - 61_000 });
  assert.equal((await send(input)).status, 200);
  assert.equal((await auth.getUserByEmail(input.email)).uid, user.uid);
  assert.equal((await oobCodes(input.email)).length, 1);
});

test("deshabilitados, suspendidos y participantes de equipos no reciben acceso", async () => {
  const disabled = await target();
  await auth.createUser({ email: disabled.email, disabled: true });
  assert.equal((await send(disabled)).status, 409);
  const blocked = await target();
  await db.doc(`staff/${blocked.email}`).set({ role: "blocked" });
  assert.equal((await send(blocked)).status, 409);
  const member = await target();
  await db.doc(`events/${eventId}/access/participants`).update({ members: { [member.email]: true } });
  assert.equal((await send(member)).status, 409);
  for (const input of [disabled, blocked, member]) assert.equal((await oobCodes(input.email)).length, 0);
  await db.doc(`events/${eventId}/access/participants`).update({ members: {} });
  await db.doc(`staff/${blocked.email}`).delete();
});

test("retirar el rol impide reenviar el acceso", async () => {
  const input = await target();
  const event = (await db.doc(`events/${eventId}`).get()).data()!;
  await db.doc(`events/${eventId}`).update({ judgeEmails: event.judgeEmails.filter((value: string) => value !== input.email) });
  assert.equal((await send(input)).status, 409);
  await assert.rejects(auth.getUserByEmail(input.email), { code: "auth/user-not-found" });
});

test("solo el superadmin envía acceso por un permiso global previamente asignado", async () => {
  const address = email("global-org");
  const input = { kind: "staff", role: "organizer", email: address };
  assert.equal((await send(input, superToken)).status, 409);
  await db.doc(`staff/${address}`).set({ role: "organizer" });
  assert.equal((await send(input, adminToken)).status, 403);
  assert.equal((await send(input, superToken)).status, 200);
  assert.equal((await oobCodes(address)).length, 1);
  assert.equal((await db.doc(`staff/${address}`).get()).data()?.role, "organizer");
});

test("el límite por responsable se aplica antes de crear cuentas", async () => {
  const input = await target();
  await db.doc(`accountInvitationLimits/${orgId}`).set({ windowStart: Date.now(), count: 200 });
  assert.equal((await send(input)).status, 429);
  await assert.rejects(auth.getUserByEmail(input.email), { code: "auth/user-not-found" });
  await db.doc(`accountInvitationLimits/${orgId}`).delete();
});
