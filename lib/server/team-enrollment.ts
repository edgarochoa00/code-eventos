import "server-only";

import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { validDocumentId } from "../submission-files";
import type { TeamEnrollmentInput, TeamEnrollmentResult } from "../team-enrollment";
import { SUPERADMIN_EMAIL, type EventDoc, type ParticipantRoster, type StaffDoc } from "../types";
import { isEmail, normalizeEmail } from "../utils";
import { adminServices } from "./firebase-admin";
import { ensureInvitationAccount, sendAccountInvitation } from "./account-invitations";

export class EnrollmentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function parseInput(body: unknown): TeamEnrollmentInput {
  if (!body || typeof body !== "object") throw new EnrollmentError(400, "La solicitud no es válida.");
  const value = body as Record<string, unknown>;
  if (!validDocumentId(value.eventId)) throw new EnrollmentError(400, "El evento no es válido.");
  if (typeof value.email !== "string" || value.email.length > 254 || !isEmail(value.email) || /[\/\s]/.test(value.email.trim())) {
    throw new EnrollmentError(400, "Escribe un correo válido para el alumno líder.");
  }
  if (Object.keys(value).some((key) => key !== "eventId" && key !== "email")) {
    throw new EnrollmentError(400, "El alta solo necesita el correo. El alumno líder completa su proyecto e integrantes.");
  }
  return { eventId: value.eventId, email: normalizeEmail(value.email) };
}

export async function handleTeamEnrollment(request: Request): Promise<TeamEnrollmentResult> {
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(header) || header.length > 16384) throw new EnrollmentError(401, "Inicia sesión para dar de alta líderes.");
  if (Number(request.headers.get("content-length")) > 16384) throw new EnrollmentError(413, "La solicitud es demasiado grande.");
  const text = await request.text();
  if (text.length > 16384) throw new EnrollmentError(413, "La solicitud es demasiado grande.");
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new EnrollmentError(400, "La solicitud no es válida."); }
  const input = parseInput(body);
  const { auth, db } = adminServices();
  let identity;
  try { identity = await auth.verifyIdToken(header.slice(7), true); }
  catch { throw new EnrollmentError(401, "Tu sesión caducó. Vuelve a iniciar sesión."); }
  if (!identity.email || !identity.email_verified) throw new EnrollmentError(403, "Verifica tu correo antes de dar de alta líderes.");
  const actor = normalizeEmail(identity.email);
  const eventRef = db.doc(`events/${input.eventId}`);
  const rosterRef = eventRef.collection("access").doc("participants");
  const projectRef = eventRef.collection("projects").doc();

  async function scope(tx: Transaction) {
    const [actorSnap, eventSnap, rosterSnap, leaderStaff] = await tx.getAll(
      db.doc(`staff/${actor}`), eventRef, rosterRef, db.doc(`staff/${input.email}`),
    );
    const actorRole = (actorSnap.data() as StaffDoc | undefined)?.role;
    const event = eventSnap.data() as EventDoc | undefined;
    if (actor !== SUPERADMIN_EMAIL && (actorRole === "blocked" || (!event?.organizerEmails.includes(actor) && actorRole !== "admin"))) {
      throw new EnrollmentError(403, "Solo el administrador o los organizadores de este evento pueden dar de alta líderes.");
    }
    if (!event) throw new EnrollmentError(404, "El evento ya no existe.");
    if (event.resultsPublished) throw new EnrollmentError(409, "Oculta los resultados antes de dar de alta líderes.");
    if (event.categoryLocked || event.judgingOpen) throw new EnrollmentError(409, "La evaluación ya comenzó. No se pueden dar de alta nuevos líderes.");
    if (event.accessVersion !== 1 || !rosterSnap.exists) throw new EnrollmentError(409, "El superadmin debe actualizar los permisos de este evento.");
    const role = (leaderStaff.data() as StaffDoc | undefined)?.role;
    if (input.email === SUPERADMIN_EMAIL || role === "admin" || role === "blocked" || event.organizerEmails.includes(input.email) || event.judgeEmails.includes(input.email)) {
      throw new EnrollmentError(409, `${input.email} tiene un rol incompatible con participar en este evento.`);
    }
    const roster = rosterSnap.data() as ParticipantRoster;
    if (roster.members[input.email]) throw new EnrollmentError(409, `${input.email} ya está registrado en este evento.`);
    return roster;
  }

  // Valida permisos y conflictos antes de crear una cuenta.
  await db.runTransaction(scope);
  try {
    const account = await ensureInvitationAccount(auth, input.email);
    if (account.disabled) throw new EnrollmentError(409, `${input.email} tiene la cuenta deshabilitada.`);
    const leaderId = account.uid;
    const leaderName = account.displayName ?? "";
    await db.runTransaction(async (tx) => {
      const roster = await scope(tx);
      const profileRef = db.doc(`users/${leaderId}`);
      const profile = await tx.get(profileRef);
      // Reserva al líder sin inventar datos del proyecto ni crear huellas de similitud.
      tx.create(projectRef, { eventId: input.eventId, registrationPending: true, title: "", category: "",
        summary: "", problem: "", solution: "", technologies: [], leaderId, leaderEmail: input.email,
        members: [{ name: leaderName, email: input.email }], memberEmails: [input.email], prototype: null, final: null,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      tx.set(rosterRef, { members: { ...roster.members, [input.email]: true }, projectId: projectRef.id } satisfies ParticipantRoster);
      if (!profile.exists) tx.create(profileRef, { uid: leaderId, email: input.email,
        displayName: leaderName, photoURL: "", lastLoginAt: null });
    });
  } catch (error) {
    if (error instanceof EnrollmentError) throw error;
    throw new EnrollmentError(503, "No se pudo terminar el alta. Revisa los datos e intenta de nuevo.");
  }
  // El correo se envía solo después de guardar el lugar en el equipo.
  try {
    const result = await sendAccountInvitation({ kind: "team", role: "leader", eventId: input.eventId, projectId: projectRef.id, email: input.email }, identity);
    return { projectId: projectRef.id, invitation: result.status };
  } catch {
    return { projectId: projectRef.id, invitation: "failed" };
  }
}
