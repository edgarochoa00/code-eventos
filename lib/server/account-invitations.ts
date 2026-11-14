import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import type { Transaction } from "firebase-admin/firestore";
import type { AccountInvitation } from "../account-invitations";
import { validDocumentId } from "../submission-files";
import { SUPERADMIN_EMAIL, type EventDoc, type ParticipantRoster, type ProjectDoc, type StaffDoc } from "../types";
import { isEmail, normalizeEmail } from "../utils";
import { adminServices } from "./firebase-admin";
import { AccessEmailError, accessEmailConfig, sendBrevoAccessEmail, type AccessEmailContext } from "./access-email";
import { feriaAccessLink } from "./access-link";

export class InvitationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const COOLDOWN_MS = 60_000;
const HOUR_MS = 3_600_000;
const MAX_PER_HOUR = 200;
export const invitationDeliveryId = (email: string) => createHash("sha256").update(normalizeEmail(email)).digest("hex");

export const teamInvitationDeliveryId = (eventId: string, projectId: string, role: "leader" | "member", email: string) =>
  createHash("sha256").update(JSON.stringify([eventId, projectId, role, normalizeEmail(email)])).digest("hex");

function parseInput(body: unknown): AccountInvitation {
  if (!body || typeof body !== "object") throw new InvitationError(400, "La solicitud no es válida.");
  const value = body as Record<string, unknown>;
  if (typeof value.email !== "string" || value.email.length > 254 || !isEmail(value.email) || /[\/\s]/.test(value.email.trim())) {
    throw new InvitationError(400, "Escribe un correo válido.");
  }
  const allowed = ["kind", "email", "eventId", "role", ...(value.kind === "team" ? ["projectId"] : [])];
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new InvitationError(400, "La solicitud contiene datos no permitidos.");
  }
  const email = normalizeEmail(value.email);
  if (value.kind === "event" && validDocumentId(value.eventId) && (value.role === "judge" || value.role === "organizer")) {
    return { kind: "event", eventId: value.eventId, role: value.role, email };
  }
  if (value.kind === "team" && validDocumentId(value.eventId) && validDocumentId(value.projectId) && (value.role === "leader" || value.role === "member")) {
    return { kind: "team", eventId: value.eventId, projectId: value.projectId, role: value.role, email };
  }
  if (value.kind === "staff" && value.eventId === undefined && (value.role === "organizer" || value.role === "admin")) {
    return { kind: "staff", role: value.role, email };
  }
  throw new InvitationError(400, "El permiso de la invitación no es válido.");
}

async function sendSetupEmail(email: string, context: AccessEmailContext) {
  const config = accessEmailConfig();
  if (config) {
    const { auth } = adminServices();
    const link = await auth.generatePasswordResetLink(email);
    return sendBrevoAccessEmail(config, email, context, feriaAccessLink(link, context.projectPath));
  }
  const emulator = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new InvitationError(503, "Falta configurar el envío de acceso.");
  const origin = emulator ? "http://127.0.0.1:9099/identitytoolkit.googleapis.com" : "https://identitytoolkit.googleapis.com";
  // Firebase envía y procesa el enlace. La contraseña se elige en su página segura.
  // No se entregan contraseñas, tokens ni enlaces de activación al organizador.
  const response = await fetch(`${origin}/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Firebase-Locale": "es" },
    body: JSON.stringify({ requestType: "PASSWORD_RESET", email,
      continueUrl: new URL(context.projectPath ? `/login?next=${encodeURIComponent(context.projectPath)}` : "/login", "https://feria2026.web.app").href,
      canHandleCodeInApp: false }),
    signal: AbortSignal.timeout(15_000), cache: "no-store",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const code = data.error?.message ?? "";
    if (/TOO_MANY_ATTEMPTS|QUOTA_EXCEEDED|RESET_PASSWORD_EXCEED_LIMIT/.test(code)) {
      throw new InvitationError(429, "Firebase limitó temporalmente los correos. Espera e intenta de nuevo.");
    }
    throw new InvitationError(502, "No se pudo enviar el correo de acceso. El permiso se conserva; vuelve a intentarlo.");
  }
  return { provider: "firebase" as const };
}

export async function ensureInvitationAccount(auth: Auth, email: string) {
  try { return await auth.getUserByEmail(email); }
  catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    try {
      return await auth.createUser({ email, emailVerified: false, password: `Feria!${randomBytes(24).toString("base64url")}9a` });
    } catch (createError) {
      if ((createError as { code?: string }).code !== "auth/email-already-exists") throw createError;
      return auth.getUserByEmail(email);
    }
  }
}

export async function handleAccountInvitation(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(header) || header.length > 16_384) throw new InvitationError(401, "Inicia sesión para enviar el acceso.");
  if (Number(request.headers.get("content-length")) > 4096) throw new InvitationError(413, "La solicitud es demasiado grande.");
  const text = await request.text();
  if (text.length > 4096) throw new InvitationError(413, "La solicitud es demasiado grande.");
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new InvitationError(400, "La solicitud no es válida."); }
  const input = parseInput(body);
  const { auth } = adminServices();
  let identity;
  try { identity = await auth.verifyIdToken(header.slice(7), true); }
  catch { throw new InvitationError(401, "Tu sesión caducó. Vuelve a iniciar sesión."); }
  return sendAccountInvitation(input, identity);
}

export async function sendAccountInvitation(input: AccountInvitation, identity: DecodedIdToken) {
  const { auth, db } = adminServices();
  if (!identity.email || !identity.email_verified) throw new InvitationError(403, "Verifica tu correo antes de enviar accesos.");
  const actor = normalizeEmail(identity.email);
  const deliveryId = input.kind === "team"
    ? teamInvitationDeliveryId(input.eventId, input.projectId, input.role, input.email)
    : invitationDeliveryId(input.email);
  const receiptRef = db.doc(`accountInvitationDeliveries/${deliveryId}`);
  const limitRef = db.doc(`accountInvitationLimits/${identity.uid}`);
  const lease = randomUUID();

  async function authorize(tx: Transaction): Promise<AccessEmailContext> {
    const [actorSnap, targetSnap] = await tx.getAll(db.doc(`staff/${actor}`), db.doc(`staff/${input.email}`));
    const actorRole = (actorSnap.data() as StaffDoc | undefined)?.role;
    const targetRole = (targetSnap.data() as StaffDoc | undefined)?.role;
    const superadmin = actor === SUPERADMIN_EMAIL;
    if (!superadmin && actorRole === "blocked") throw new InvitationError(403, "Tu cuenta está suspendida.");
    if (input.email !== SUPERADMIN_EMAIL && targetRole === "blocked") throw new InvitationError(409, "No se puede enviar acceso a una cuenta suspendida.");
    if (input.kind === "staff") {
      if (!superadmin) throw new InvitationError(403, "Solo el superadmin puede enviar acceso por un permiso global.");
      if (targetRole !== input.role) throw new InvitationError(409, "Guarda primero ese permiso para este correo.");
      return { role: input.role, eventName: null };
    }
    const [eventSnap, rosterSnap] = await tx.getAll(db.doc(`events/${input.eventId}`), db.doc(`events/${input.eventId}/access/participants`));
    const event = eventSnap.data() as EventDoc | undefined;
    const manages = superadmin || actorRole === "admin" || event?.organizerEmails.includes(actor);
    const roster = rosterSnap.data() as ParticipantRoster | undefined;
    if (input.kind === "team") {
      if (!event || event.accessVersion !== 1) throw new InvitationError(404, "El equipo no está disponible.");
      const projectPath = `/eventos/${input.eventId}/proyectos/${input.projectId}`;
      const projectSnap = await tx.get(eventSnap.ref.collection("projects").doc(input.projectId));
      const project = projectSnap.data() as ProjectDoc | undefined;
      const isLeader = project?.leaderId === identity.uid && project.leaderEmail === actor;
      if (input.role === "leader" ? !manages : !isLeader) {
        throw new InvitationError(403, "Solo quien administra el alta puede enviar este acceso.");
      }
      if (!project || !project.memberEmails.includes(input.email) || roster?.members[input.email] !== true ||
        (project.leaderEmail === input.email) !== (input.role === "leader")) {
        throw new InvitationError(409, "Ese correo ya no tiene este lugar en el equipo.");
      }
      if (input.email === SUPERADMIN_EMAIL || targetRole === "admin" || event.organizerEmails.includes(input.email) || event.judgeEmails.includes(input.email)) {
        throw new InvitationError(409, "Ese correo tiene un rol incompatible con participar en este equipo.");
      }
      return { role: input.role, eventName: event.name, projectPath };
    }
    if (!event || !manages) {
      throw new InvitationError(403, "Solo la administración de este evento puede enviar sus accesos.");
    }
    const assigned = input.role === "judge" ? event.judgeEmails : event.organizerEmails;
    if (!assigned.includes(input.email)) throw new InvitationError(409, "Guarda primero ese rol en este evento.");
    if (input.role === "judge" && (event.organizerEmails.includes(input.email) || input.email === SUPERADMIN_EMAIL || targetRole === "admin")) {
      throw new InvitationError(409, "Ese correo administra el evento y no puede entrar como juez.");
    }
    if (roster?.members[input.email]) {
      throw new InvitationError(409, "Ese correo pertenece a un equipo y no puede recibir ese rol.");
    }
    return { role: input.role, eventName: event.name || "tu evento de Feria 2026" };
  }

  const recentlySent = await db.runTransaction(async (tx) => {
    await authorize(tx);
    const [receipt, limit] = await tx.getAll(receiptRef, limitRef);
    const now = Date.now();
    const lastAttempt = receipt.data()?.lastAttemptAt ?? 0;
    if (now - lastAttempt < COOLDOWN_MS) {
      if (receipt.data()?.status === "sent") return true;
      throw new InvitationError(429, "Espera un minuto antes de volver a enviar el acceso a este correo.");
    }
    const windowStart = limit.data()?.windowStart ?? now;
    const count = now - windowStart < HOUR_MS ? limit.data()?.count ?? 0 : 0;
    if (count >= MAX_PER_HOUR) throw new InvitationError(429, "Alcanzaste el límite de envíos por hora. Espera antes de continuar.");
    tx.set(limitRef, { windowStart: count ? windowStart : now, count: count + 1 });
    tx.set(receiptRef, { lease, status: "sending", lastAttemptAt: now });
    return false;
  });
  if (recentlySent) return { status: "recently-sent" as const };

  try {
    const account = await ensureInvitationAccount(auth, input.email);
    if (account.disabled) throw new InvitationError(409, "La cuenta está deshabilitada en Firebase Authentication.");
    // Revisa de nuevo los permisos si cambiaron durante la creación de la cuenta.
    const context = await db.runTransaction(authorize);
    const delivery = await sendSetupEmail(input.email, context);
    await db.runTransaction(async (tx) => {
      const receipt = await tx.get(receiptRef);
      if (receipt.data()?.lease === lease) tx.update(receiptRef, { status: "sent", lease: null, provider: delivery.provider,
        ...("messageId" in delivery ? { messageId: delivery.messageId } : {}) });
    });
    return { status: "sent" as const };
  } catch (error) {
    await db.runTransaction(async (tx) => {
      const receipt = await tx.get(receiptRef);
      if (receipt.data()?.lease === lease) tx.update(receiptRef, { status: "failed", lease: null });
    }).catch(() => undefined);
    if (error instanceof InvitationError) throw error;
    if (error instanceof AccessEmailError) throw new InvitationError(error.status, error.message);
    throw new InvitationError(503, "No se pudo enviar el acceso. El permiso se conserva; vuelve a intentarlo.");
  }
}
