import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { GET as listUsersGet } from "../app/api/admin/users/route";
import { POST as userDeletionPost } from "../app/api/admin/user-deletion/route";
import { invitationDeliveryId, teamInvitationDeliveryId } from "../lib/server/account-invitations";
import { adminServices } from "../lib/server/firebase-admin";
import { SUPERADMIN_EMAIL } from "../lib/types";
import type { UserDeletionInspection, UserDeletionResult } from "../lib/user-deletion";

assert.ok(process.env.FIRESTORE_EMULATOR_HOST);
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST);
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-code";
process.env.NEXT_PUBLIC_USE_EMULATORS = "true";

const { auth, db } = adminServices();
const prefix = `del-${Date.now()}`;
const emailFor = (id: string) => `${prefix}-${id}@example.com`;
const trackUids: string[] = [];
const trackStaffEmails: string[] = [];
const trackEvents: string[] = [];
const trackFingerprints: string[] = [];
const trackDeliveries: string[] = [];
const trackWithdrawals: string[] = [];

let superToken = "";
let regularAdminToken = "";
let normalUserToken = "";
let organizerToken = "";

async function signInEmulator(email: string, password: string): Promise<string> {
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = (await response.json()) as { idToken?: string };
  assert.ok(data.idToken, `Missing emulator idToken for ${email}`);
  return data.idToken;
}

async function createAccount(opts: { email?: string; displayName?: string; emailVerified?: boolean; withProfile?: boolean }) {
  const password = "EmulatorOnly!123";
  const user = await auth.createUser({
    ...(opts.email ? { email: opts.email } : {}),
    password,
    displayName: opts.displayName ?? "Usuario Prueba",
    emailVerified: opts.emailVerified ?? true,
  });
  trackUids.push(user.uid);

  if (opts.withProfile && opts.email) {
    await db.doc(`users/${user.uid}`).set({
      uid: user.uid,
      email: opts.email,
      displayName: opts.displayName ?? "Usuario Prueba",
    });
  }

  const token = opts.email ? await signInEmulator(opts.email, password) : "";
  return { user, token };
}

async function callListUsers(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await listUsersGet(new Request("http://localhost/api/admin/users", { method: "GET", headers }));
  return { status: response.status, data: await response.json() };
}

async function callUserDeletion(body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await userDeletionPost(
    new Request("http://localhost/api/admin/user-deletion", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: response.status, data: await response.json() };
}

before(async () => {
  const superAcc = await createAccount({
    email: SUPERADMIN_EMAIL,
    displayName: "Superadmin",
    emailVerified: true,
    withProfile: true,
  });
  superToken = superAcc.token;

  const adminEmail = emailFor("admin");
  const adminAcc = await createAccount({ email: adminEmail, displayName: "Admin Normal", withProfile: true });
  trackStaffEmails.push(adminEmail);
  await db.doc(`staff/${adminEmail}`).set({ email: adminEmail, role: "admin", updatedAt: 1, updatedBy: SUPERADMIN_EMAIL });
  regularAdminToken = adminAcc.token;

  const orgEmail = emailFor("organizer");
  const orgAcc = await createAccount({ email: orgEmail, displayName: "Organizador", withProfile: true });
  trackStaffEmails.push(orgEmail);
  await db.doc(`staff/${orgEmail}`).set({ email: orgEmail, role: "organizer", updatedAt: 1, updatedBy: SUPERADMIN_EMAIL });
  organizerToken = orgAcc.token;

  const userAcc = await createAccount({ email: emailFor("normal"), displayName: "Usuario Normal", withProfile: true });
  normalUserToken = userAcc.token;
});

after(async () => {
  for (const eventId of trackEvents) {
    await db.recursiveDelete(db.doc(`events/${eventId}`));
  }
  for (const id of trackFingerprints) {
    await db.doc(`fingerprints/${id}`).delete();
  }
  for (const id of trackDeliveries) {
    await db.doc(`accountInvitationDeliveries/${id}`).delete();
  }
  for (const id of trackWithdrawals) {
    await db.doc(`projectWithdrawals/${id}`).delete();
  }
  for (const mail of trackStaffEmails) {
    await db.doc(`staff/${mail}`).delete();
  }
  for (const uid of trackUids) {
    await auth.deleteUser(uid).catch(() => undefined);
    await db.doc(`users/${uid}`).delete();
    await db.doc(`accountInvitationLimits/${uid}`).delete();
    await db.doc(`withdrawnAccounts/${uid}`).delete();
  }
});

test("solo el superadministrador verificado puede listar, inspeccionar o eliminar usuarios, y nunca al superadmin", async () => {
  assert.equal((await callListUsers()).status, 401);
  assert.equal((await callListUsers("token-invalido")).status, 401);
  assert.equal((await callListUsers(normalUserToken)).status, 403);
  assert.equal((await callListUsers(organizerToken)).status, 403);
  assert.equal((await callListUsers(regularAdminToken)).status, 403);

  const inspectPayload = { action: "inspect", email: emailFor("target") };
  assert.equal((await callUserDeletion(inspectPayload)).status, 401);
  assert.equal((await callUserDeletion(inspectPayload, normalUserToken)).status, 403);
  assert.equal((await callUserDeletion(inspectPayload, organizerToken)).status, 403);
  assert.equal((await callUserDeletion(inspectPayload, regularAdminToken)).status, 403);

  const invalidPayload = await callUserDeletion({ action: "invalid", email: emailFor("target") }, superToken);
  assert.equal(invalidPayload.status, 400);

  const protectSuper = await callUserDeletion({ action: "inspect", email: SUPERADMIN_EMAIL }, superToken);
  assert.equal(protectSuper.status, 403);

  const protectSuperDelete = await callUserDeletion(
    { action: "delete", email: SUPERADMIN_EMAIL, inspectionHash: "a".repeat(64) },
    superToken,
  );
  assert.equal(protectSuperDelete.status, 403);

  // Superadmin sin correo verificado tampoco puede pasar.
  await auth.updateUser((await auth.getUserByEmail(SUPERADMIN_EMAIL)).uid, { emailVerified: false });
  const unverifiedToken = await signInEmulator(SUPERADMIN_EMAIL, "EmulatorOnly!123");
  assert.equal((await callListUsers(unverifiedToken)).status, 403);
  assert.equal((await callUserDeletion(inspectPayload, unverifiedToken)).status, 403);
  await auth.updateUser((await auth.getUserByEmail(SUPERADMIN_EMAIL)).uid, { emailVerified: true });
  superToken = await signInEmulator(SUPERADMIN_EMAIL, "EmulatorOnly!123");
});

test("GET /api/admin/users lista cuentas solo en Auth y usuario sin vínculos se elimina por completo", async () => {
  const cleanEmail = emailFor("clean");
  const cleanAcc = await createAccount({ email: cleanEmail, displayName: "Solo Auth y Perfil", withProfile: true });
  const authOnlyEmail = emailFor("auth-only");
  const authOnly = await createAccount({ email: authOnlyEmail, displayName: "Huérfano Auth", withProfile: false });

  const deliveryId = invitationDeliveryId(cleanEmail);
  const receiptId = `${prefix}_receipt_clean`;
  trackDeliveries.push(deliveryId);
  trackWithdrawals.push(receiptId);

  await db.doc(`accountInvitationDeliveries/${deliveryId}`).set({ email: cleanEmail, sentAt: 1 });
  await db.doc(`accountInvitationLimits/${cleanAcc.user.uid}`).set({ count: 1, windowStart: 1 });
  await db.doc(`withdrawnAccounts/${cleanAcc.user.uid}`).set({ email: cleanEmail, withdrawnAt: 1 });
  await db.doc(`projectWithdrawals/${receiptId}`).set({ actorUid: cleanAcc.user.uid, completed: true, accounts: [] });

  const listRes = await callListUsers(superToken);
  assert.equal(listRes.status, 200);
  const listed = listRes.data.users as Array<{ uid: string; email: string }>;
  assert.ok(listed.some((u) => u.uid === cleanAcc.user.uid && u.email === cleanEmail));
  assert.ok(listed.some((u) => u.uid === authOnly.user.uid && u.email === authOnlyEmail));

  const inspectRes = await callUserDeletion({ action: "inspect", email: cleanEmail }, superToken);
  assert.equal(inspectRes.status, 200);
  const inspection = inspectRes.data as UserDeletionInspection;
  assert.equal(inspection.existsAnywhere, true);
  assert.equal(inspection.hasLinks, false);
  assert.equal(inspection.records.authAccounts.length, 1);
  assert.equal(inspection.records.userProfilesCount, 1);
  assert.equal(inspection.records.invitationDeliveriesCount, 1);
  assert.equal(inspection.records.invitationLimitsCount, 1);
  assert.equal(inspection.records.withdrawnMarkersCount, 1);
  assert.equal(inspection.records.withdrawalReceiptsCount, 1);

  const deleteRes = await callUserDeletion(
    { action: "delete", email: cleanEmail, inspectionHash: inspection.inspectionHash },
    superToken,
  );
  assert.equal(deleteRes.status, 200, JSON.stringify(deleteRes.data));
  const deleted = deleteRes.data as UserDeletionResult;
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.removedAuthAccounts, 1);

  await assert.rejects(auth.getUser(cleanAcc.user.uid), { code: "auth/user-not-found" });
  assert.equal((await db.doc(`users/${cleanAcc.user.uid}`).get()).exists, false);
  assert.equal((await db.doc(`accountInvitationDeliveries/${deliveryId}`).get()).exists, false);
  assert.equal((await db.doc(`accountInvitationLimits/${cleanAcc.user.uid}`).get()).exists, false);
  assert.equal((await db.doc(`withdrawnAccounts/${cleanAcc.user.uid}`).get()).exists, false);
  assert.equal((await db.doc(`projectWithdrawals/${receiptId}`).get()).exists, false);

  // El listado de Auth tampoco lo muestra ya y el mismo correo puede volver a registrarse desde cero.
  const listAfter = await callListUsers(superToken);
  assert.equal(listAfter.status, 200);
  assert.equal(
    (listAfter.data.users as Array<{ uid: string }>).some((u) => u.uid === cleanAcc.user.uid),
    false,
  );
  const recreated = await createAccount({ email: cleanEmail, displayName: "Nueva Cuenta", withProfile: false });
  assert.notEqual(recreated.user.uid, cleanAcc.user.uid);
});

test("inspecciona vínculos completos, detecta cambios (409) y al confirmar limpia todo sin dejar rastro", async () => {
  const targetEmail = emailFor("linked");
  const teammateEmail = emailFor("teammate");
  const otherLeaderEmail = emailFor("other-leader");
  const secondJudgeEmail = emailFor("judge-2");
  const otherOrgEmail = emailFor("other-org");

  const targetAcc = await createAccount({ email: targetEmail, displayName: "Usuario Ligado", withProfile: true });
  await createAccount({ email: teammateEmail, displayName: "Compañero", withProfile: true });
  const otherLeaderAcc = await createAccount({ email: otherLeaderEmail, displayName: "Otro Líder", withProfile: true });
  const secondJudgeAcc = await createAccount({ email: secondJudgeEmail, displayName: "Segundo Juez", withProfile: true });

  // Staff del usuario + otro staff con updatedBy apuntando al usuario.
  trackStaffEmails.push(targetEmail, otherOrgEmail);
  await db.doc(`staff/${targetEmail}`).set({ email: targetEmail, role: "organizer", updatedAt: 1, updatedBy: SUPERADMIN_EMAIL });
  await db.doc(`staff/${otherOrgEmail}`).set({ email: otherOrgEmail, role: "organizer", updatedAt: 1, updatedBy: targetEmail });

  // 1) Evento propio (debe eliminarse completo junto con proyectos, evaluaciones, fingerprints y roster).
  const ownedEventId = `${prefix}-owned`;
  trackEvents.push(ownedEventId);
  trackFingerprints.push(`${prefix}-fp-owned`);
  await db.doc(`events/${ownedEventId}`).set({
    name: "Feria Propia",
    institution: "TEC",
    ownerId: targetAcc.user.uid,
    ownerEmail: targetEmail,
    organizerEmails: [targetEmail],
    judgeEmails: [],
    phases: { prototype: true },
    resultsPublished: false,
  });
  await db.doc(`events/${ownedEventId}/projects/${prefix}-fp-owned`).set({
    eventId: ownedEventId,
    title: "Proyecto en Evento Propio",
    category: "Software",
    leaderId: otherLeaderAcc.user.uid,
    leaderEmail: otherLeaderEmail,
    memberEmails: [otherLeaderEmail],
  });
  await db.doc(`fingerprints/${prefix}-fp-owned`).set({ projectId: `${prefix}-fp-owned`, eventId: ownedEventId });
  await db.doc(`events/${ownedEventId}/evaluations/${prefix}-ev-owned`).set({
    projectId: `${prefix}-fp-owned`,
    phase: "prototype",
    judgeId: secondJudgeAcc.user.uid,
    judgeEmail: secondJudgeEmail,
    scores: { r1: 9 },
    total: 90,
  });
  await db.doc(`events/${ownedEventId}/access/participants`).set({
    members: { [otherLeaderEmail]: true },
  });

  // 2) Evento compartido publicado donde el usuario es co-organizador, juez, líder de un proyecto, integrante de otro y evaluador.
  const sharedEventId = `${prefix}-shared`;
  const ledProjectId = `${prefix}-led`;
  const memberProjectId = `${prefix}-member`;
  trackEvents.push(sharedEventId);
  trackFingerprints.push(ledProjectId);

  const teamDeliveryId = teamInvitationDeliveryId(sharedEventId, memberProjectId, "member", targetEmail);
  const pendingWithdrawalId = `${sharedEventId}_pending_user`;
  trackDeliveries.push(teamDeliveryId);
  trackWithdrawals.push(pendingWithdrawalId);
  await db.doc(`accountInvitationDeliveries/${teamDeliveryId}`).set({ email: targetEmail, sentAt: 1 });
  await db.doc(`projectWithdrawals/${pendingWithdrawalId}`).set({
    actorUid: "another-actor",
    completed: false,
    accounts: [{ uid: targetAcc.user.uid, email: targetEmail }, { uid: "stay", email: "stay@example.com" }],
  });

  await db.doc(`events/${sharedEventId}`).set({
    name: "Feria Nacional",
    institution: "Campus Central",
    ownerId: "external-owner",
    ownerEmail: otherOrgEmail,
    organizerEmails: [otherOrgEmail, targetEmail],
    judgeEmails: [targetEmail, secondJudgeEmail],
    judgeAssignments: {
      [targetEmail]: { projectIds: [memberProjectId] },
      [secondJudgeEmail]: { projectIds: [memberProjectId] },
    },
    phases: { prototype: true },
    criteria: [{ id: "r1", name: "Impacto", description: "", weight: 100 }],
    categories: ["Software"],
    resultsPublished: true,
    results: {
      prototype: [
        { projectId: ledProjectId, title: "Proyecto Líder", category: "Software", score: 100, judges: 1 },
        { projectId: memberProjectId, title: "Proyecto Equipo", category: "Software", score: 60, judges: 2 },
      ],
    },
  });

  await db.doc(`events/${sharedEventId}/projects/${ledProjectId}`).set({
    eventId: sharedEventId,
    title: "Proyecto Líder",
    category: "Software",
    leaderId: targetAcc.user.uid,
    leaderEmail: targetEmail,
    memberEmails: [targetEmail, teammateEmail],
    members: [{ email: targetEmail }, { email: teammateEmail }],
    prototype: { submittedBy: targetEmail, files: [] },
  });
  await db.doc(`fingerprints/${ledProjectId}`).set({ projectId: ledProjectId, eventId: sharedEventId });

  await db.doc(`events/${sharedEventId}/projects/${memberProjectId}`).set({
    eventId: sharedEventId,
    title: "Proyecto Equipo",
    category: "Software",
    leaderId: otherLeaderAcc.user.uid,
    leaderEmail: otherLeaderEmail,
    memberEmails: [otherLeaderEmail, targetEmail],
    members: [{ email: otherLeaderEmail }, { email: targetEmail }],
    prototype: { submittedBy: targetEmail, files: [] },
    final: { submittedBy: targetEmail, files: [] },
    judging: { judgeEmails: [targetEmail, secondJudgeEmail] },
    feedback: {
      prototype: {
        score: 6,
        judges: 2,
        criteria: { r1: 6 },
        comments: ["Comentario eliminado", "Comentario conservado"],
      },
    },
  });

  await db.doc(`events/${sharedEventId}/access/participants`).set({
    members: {
      [targetEmail]: true,
      [teammateEmail]: true,
      [otherLeaderEmail]: true,
    },
    projectId: ledProjectId,
  });

  // Evaluación del usuario sobre memberProjectId (score 40) y sobre ledProjectId (score 100), más segundo juez sobre memberProjectId (score 80).
  await db.doc(`events/${sharedEventId}/evaluations/${prefix}-ev-led`).set({
    projectId: ledProjectId,
    phase: "prototype",
    judgeId: targetAcc.user.uid,
    judgeEmail: targetEmail,
    scores: { r1: 10 },
    total: 100,
    comment: "Auto eval",
  });
  await db.doc(`events/${sharedEventId}/evaluations/${prefix}-ev-member-target`).set({
    projectId: memberProjectId,
    phase: "prototype",
    judgeId: targetAcc.user.uid,
    judgeEmail: targetEmail,
    scores: { r1: 4 },
    total: 40,
    comment: "Comentario eliminado",
  });
  await db.doc(`events/${sharedEventId}/evaluations/${prefix}-ev-member-keep`).set({
    projectId: memberProjectId,
    phase: "prototype",
    judgeId: secondJudgeAcc.user.uid,
    judgeEmail: secondJudgeEmail,
    scores: { r1: 8 },
    total: 80,
    comment: "Comentario conservado",
  });

  // 3) Evento con padrón huérfano del usuario.
  const orphanEventId = `${prefix}-orphan`;
  trackEvents.push(orphanEventId);
  await db.doc(`events/${orphanEventId}`).set({
    name: "Feria Huérfana",
    institution: "Campus Norte",
    ownerId: "external-owner",
    ownerEmail: otherOrgEmail,
    organizerEmails: [otherOrgEmail],
    judgeEmails: [],
  });
  await db.doc(`events/${orphanEventId}/access/participants`).set({
    members: { [targetEmail]: true, [otherLeaderEmail]: true },
  });

  // Paso 1: Inspección debe reportar todos los vínculos sin modificar nada todavía.
  const inspectRes = await callUserDeletion({ action: "inspect", email: targetEmail }, superToken);
  assert.equal(inspectRes.status, 200);
  const inspection = inspectRes.data as UserDeletionInspection;
  assert.equal(inspection.hasLinks, true);
  assert.equal(inspection.links.staffRole, "organizer");
  assert.equal(inspection.records.staffUpdatedByCount, 1);
  assert.equal(inspection.links.ownedEvents.length, 1);
  assert.equal(inspection.links.ownedEvents[0]?.eventId, ownedEventId);
  assert.equal(inspection.links.coOrganizerEvents.length, 1);
  assert.equal(inspection.links.judgeEvents.length, 1);
  assert.equal(inspection.links.judgeEvents[0]?.hasJudgeAssignments, true);
  assert.equal(inspection.links.evaluationsByEvent.length, 1);
  assert.equal(inspection.links.evaluationsByEvent[0]?.evaluationsCount, 2);
  assert.equal(inspection.links.ledProjects.length, 1);
  assert.deepEqual(inspection.links.ledProjects[0]?.otherMembers, [teammateEmail]);
  assert.equal(inspection.links.memberProjects.length, 1);
  assert.equal(inspection.links.orphanRosters.length, 1);
  assert.equal(inspection.links.orphanRosters[0]?.eventId, orphanEventId);

  // Confirma que inspeccionar no modificó ni borró nada aún.
  assert.ok(await auth.getUser(targetAcc.user.uid));
  assert.equal((await db.doc(`events/${ownedEventId}`).get()).exists, true);
  assert.equal((await db.doc(`events/${sharedEventId}/projects/${ledProjectId}`).get()).exists, true);

  // Si cambia algo entre inspección y borrado, devuelve 409 con nueva inspección.
  await db.doc(`events/${orphanEventId}`).update({ name: "Feria Huérfana Editada" });
  const conflictRes = await callUserDeletion(
    { action: "delete", email: targetEmail, inspectionHash: inspection.inspectionHash },
    superToken,
  );
  assert.equal(conflictRes.status, 409);
  const updatedInspection = conflictRes.data.inspection as UserDeletionInspection;
  assert.ok(updatedInspection?.inspectionHash);
  assert.notEqual(updatedInspection.inspectionHash, inspection.inspectionHash);

  // Paso 2: Confirmación con el hash vigente ejecuta borrado total.
  const deleteRes = await callUserDeletion(
    { action: "delete", email: targetEmail, inspectionHash: updatedInspection.inspectionHash },
    superToken,
  );
  assert.equal(deleteRes.status, 200, JSON.stringify(deleteRes.data));
  const result = deleteRes.data as UserDeletionResult;
  assert.equal(result.deleted, true);
  assert.equal(result.removedAuthAccounts, 1);

  // Verificación exhaustiva: Auth, users, staff, receipts y evento propio eliminados por completo.
  await assert.rejects(auth.getUser(targetAcc.user.uid), { code: "auth/user-not-found" });
  assert.equal((await db.doc(`users/${targetAcc.user.uid}`).get()).exists, false);
  assert.equal((await db.doc(`staff/${targetEmail}`).get()).exists, false);
  assert.equal((await db.doc(`accountInvitationDeliveries/${teamDeliveryId}`).get()).exists, false);
  assert.equal((await db.doc(`events/${ownedEventId}`).get()).exists, false);
  assert.equal((await db.doc(`events/${ownedEventId}/projects/${prefix}-fp-owned`).get()).exists, false);
  assert.equal((await db.doc(`fingerprints/${prefix}-fp-owned`).get()).exists, false);

  // staff.updatedBy y projectWithdrawals pendientes quedan saneados.
  assert.equal((await db.doc(`staff/${otherOrgEmail}`).get()).data()?.updatedBy, "");
  assert.deepEqual((await db.doc(`projectWithdrawals/${pendingWithdrawalId}`).get()).data()?.accounts, [
    { uid: "stay", email: "stay@example.com" },
  ]);

  // Evento compartido se conserva pero desvincula al usuario y recalcula resultados publicados.
  const sharedAfter = (await db.doc(`events/${sharedEventId}`).get()).data();
  assert.ok(sharedAfter);
  assert.deepEqual(sharedAfter.organizerEmails, [otherOrgEmail]);
  assert.deepEqual(sharedAfter.judgeEmails, [secondJudgeEmail]);
  assert.deepEqual(sharedAfter.judgeAssignments, { [secondJudgeEmail]: { projectIds: [memberProjectId] } });
  assert.deepEqual(sharedAfter.results.prototype, [
    { projectId: memberProjectId, title: "Proyecto Equipo", category: "Software", score: 80, judges: 1 },
  ]);

  // Proyecto liderado fue eliminado con su fingerprint y evaluaciones; compañero liberado en roster.
  assert.equal((await db.doc(`events/${sharedEventId}/projects/${ledProjectId}`).get()).exists, false);
  assert.equal((await db.doc(`fingerprints/${ledProjectId}`).get()).exists, false);
  assert.equal((await db.doc(`events/${sharedEventId}/evaluations/${prefix}-ev-led`).get()).exists, false);
  assert.equal((await db.doc(`events/${sharedEventId}/evaluations/${prefix}-ev-member-target`).get()).exists, false);
  assert.equal((await db.doc(`events/${sharedEventId}/evaluations/${prefix}-ev-member-keep`).get()).exists, true);

  const sharedRoster = (await db.doc(`events/${sharedEventId}/access/participants`).get()).data();
  assert.deepEqual(sharedRoster?.members, { [otherLeaderEmail]: true });
  assert.equal(sharedRoster?.projectId, "");

  // Proyecto donde solo era integrante conserva al resto del equipo y recalcula su retroalimentación sin el juez borrado.
  const memberProjAfter = (await db.doc(`events/${sharedEventId}/projects/${memberProjectId}`).get()).data();
  assert.deepEqual(memberProjAfter?.memberEmails, [otherLeaderEmail]);
  assert.deepEqual(memberProjAfter?.members, [{ email: otherLeaderEmail }]);
  assert.equal(memberProjAfter?.prototype?.submittedBy, "");
  assert.equal(memberProjAfter?.final?.submittedBy, "");
  assert.deepEqual(memberProjAfter?.judging?.judgeEmails, [secondJudgeEmail]);
  assert.deepEqual(memberProjAfter?.feedback?.prototype, {
    score: 80,
    judges: 1,
    rank: 1,
    of: 1,
    criteria: { r1: 8 },
    comments: ["Comentario conservado"],
  });

  // Padrón huérfano limpio para el usuario, conservando a otros.
  assert.deepEqual((await db.doc(`events/${orphanEventId}/access/participants`).get()).data()?.members, {
    [otherLeaderEmail]: true,
  });

  // Nueva inspección sobre el correo confirma cero registros en todo Firebase y Auth.
  const verifyZero = await callUserDeletion({ action: "inspect", email: targetEmail }, superToken);
  assert.equal(verifyZero.status, 200);
  assert.equal((verifyZero.data as UserDeletionInspection).existsAnywhere, false);
});

test("cuenta en Authentication sin correo se puede inspeccionar y eliminar por UID", async () => {
  const noEmailAcc = await createAccount({ displayName: "Cuenta Sin Correo", withProfile: false });
  const inspectRes = await callUserDeletion({ action: "inspect", uid: noEmailAcc.user.uid }, superToken);
  assert.equal(inspectRes.status, 200);
  const inspection = inspectRes.data as UserDeletionInspection;
  assert.equal(inspection.existsAnywhere, true);
  assert.deepEqual(inspection.target.uids, [noEmailAcc.user.uid]);

  const deleteRes = await callUserDeletion(
    { action: "delete", uid: noEmailAcc.user.uid, inspectionHash: inspection.inspectionHash },
    superToken,
  );
  assert.equal(deleteRes.status, 200, JSON.stringify(deleteRes.data));
  assert.equal((deleteRes.data as UserDeletionResult).removedAuthAccounts, 1);
  await assert.rejects(auth.getUser(noEmailAcc.user.uid), { code: "auth/user-not-found" });
});
