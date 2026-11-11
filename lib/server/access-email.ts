import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { InvitationScope } from "../account-invitations";
import { isEmail, normalizeEmail } from "../utils";

export class AccessEmailError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type AccessEmailContext = { role: InvitationScope["role"]; eventName: string | null; projectPath?: string };
export type BrevoAccessConfig = { apiKey: string; from: string };
const ROLE_LABEL = { judge: "juez", organizer: "organizador", admin: "administrador", leader: "alumno líder", member: "integrante del equipo" };
let template: Promise<string> | undefined;

export function accessEmailConfig(env: Readonly<Record<string, string | undefined>> = process.env): BrevoAccessConfig | null {
  // Los emuladores nunca usan cuentas ni claves de correo reales.
  if (env.NEXT_PUBLIC_USE_EMULATORS === "true" || env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST) return null;
  const provider = env.FERIA_MAIL_PROVIDER?.trim() || "firebase";
  if (provider === "firebase") return null;
  if (provider !== "brevo") throw new AccessEmailError(503, "El proveedor de correo no está configurado correctamente.");
  const apiKey = env.FERIA_BREVO_API_KEY?.trim();
  const from = normalizeEmail(env.FERIA_MAIL_FROM ?? "");
  if (!apiKey || /[\r\n]/.test(apiKey) || !isEmail(from) || /[\s\/]/.test(from)) {
    throw new AccessEmailError(503, "Falta completar la conexión del correo de Feria 2026.");
  }
  return { apiKey, from };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export async function renderAccessEmail(email: string, context: AccessEmailContext, actionUrl: string) {
  const url = new URL(actionUrl);
  if (url.protocol !== "https:") throw new AccessEmailError(503, "No se pudo preparar el enlace seguro de acceso.");
  template ??= readFile(path.join(process.cwd(), "emails/acceso.html"), "utf8");
  const role = ROLE_LABEL[context.role];
  const eventName = context.eventName ?? "la plataforma Feria 2026";
  const afterSetup = context.role === "leader" ? "Después podrás completar el formulario de tu proyecto y agregar a tus integrantes."
    : context.role === "member" ? "Después podrás consultar el proyecto de tu equipo."
      : "Después podrás ver las opciones de tu rol.";
  const instructions = `Escribe tu nombre completo y elige tu contraseña. ${afterSetup}`;
  const values: Record<string, string> = { ROLE_LABEL: role, EVENT_NAME: eventName,
    RECIPIENT_EMAIL: email, ACTION_URL: url.href, ACCESS_INSTRUCTIONS: instructions };
  const html = (await template).replace(/\{\{(ROLE_LABEL|EVENT_NAME|RECIPIENT_EMAIL|ACTION_URL|ACCESS_INSTRUCTIONS)\}\}/g,
    (_, key: string) => escapeHtml(values[key]));
  return { subject: "Tu acceso a Feria 2026", html,
    text: `Feria 2026 · TecNM Culiacán\n\nHola,\nTe han dado acceso como ${role} en ${eventName}.\nCuenta: ${email}\n\n${instructions}\nEnlace personal: ${url.href}\n\nSi ya tienes cuenta, puedes seguir entrando con tu contraseña habitual. Solo cambiará si completas este enlace.\nNo compartas el enlace. Si caduca, solicita uno nuevo a quien te invitó. Si no esperabas esta invitación, puedes ignorarla.\n\nEquipo Feria 2026\nhttps://feria2026.web.app` };
}

export async function sendBrevoAccessEmail(config: BrevoAccessConfig, email: string, context: AccessEmailContext, actionUrl: string) {
  const message = await renderAccessEmail(email, context, actionUrl);
  let response: Response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(15_000),
      headers: { "api-key": config.apiKey, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ sender: { name: "Feria 2026", email: config.from },
        to: [{ email, contactPixelTrackingConsent: false }],
        replyTo: { name: "Feria 2026", email: config.from }, subject: message.subject,
        htmlContent: message.html, textContent: message.text }),
    });
  } catch {
    throw new AccessEmailError(502, "No se pudo confirmar el envío. Revisa tu correo antes de volver a solicitar el acceso.");
  }
  if (response.status !== 201) {
    throw new AccessEmailError(response.status === 429 ? 429 : 502,
      response.status === 429 ? "El servicio limitó temporalmente los correos. Espera e intenta de nuevo."
        : "No se pudo enviar el correo de acceso. El permiso se conserva; vuelve a intentarlo.");
  }
  const result = await response.json().catch(() => ({}));
  if (typeof result.messageId !== "string" || !result.messageId) {
    throw new AccessEmailError(502, "El servicio no confirmó el envío. Revisa tu correo antes de volver a solicitar el acceso.");
  }
  return { provider: "brevo" as const, messageId: result.messageId };
}
