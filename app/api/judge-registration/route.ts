import { adminServices } from "@/lib/server/firebase-admin";
import { validDocumentId } from "@/lib/submission-files";
import { SUPERADMIN_EMAIL, type EventDoc, type StaffDoc } from "@/lib/types";
import { normalizeEmail } from "@/lib/utils";

function reply(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(header) || header.length > 16_384) {
    return reply({ error: "Inicia sesión para consultar el registro." }, 401);
  }
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!validDocumentId(eventId)) return reply({ error: "El evento no es válido." }, 400);

  try {
    const { auth, db } = adminServices();
    const identity = await auth.verifyIdToken(header.slice(7), true).catch(() => null);
    if (!identity) return reply({ error: "Tu sesión caducó. Vuelve a iniciar sesión." }, 401);
    if (!identity.email || !identity.email_verified) return reply({ error: "Verifica tu correo para continuar." }, 403);

    const email = normalizeEmail(identity.email);
    const [eventSnapshot, staffSnapshot, withdrawn] = await db.getAll(
      db.doc(`events/${eventId}`), db.doc(`staff/${email}`), db.doc(`withdrawnAccounts/${identity.uid}`),
    );
    const event = eventSnapshot.data() as EventDoc | undefined;
    const role = (staffSnapshot.data() as StaffDoc | undefined)?.role;
    const canManage = email === SUPERADMIN_EMAIL
      || (role !== "blocked" && (role === "admin" || event?.organizerEmails.includes(email)));
    if (!canManage || withdrawn.exists) return reply({ error: "Solo la administración de este evento puede consultar el registro." }, 403);
    if (!event) return reply({ error: "El evento ya no existe." }, 404);

    // Una invitación crea una cuenta sin verificar. El registro se completa al verificar el correo.
    const emails = Array.from(new Set(event.judgeEmails.map(normalizeEmail)));
    const registered = new Set<string>();
    for (let start = 0; start < emails.length; start += 100) {
      const batch = emails.slice(start, start + 100).map((email) => ({ email }));
      const { users } = await auth.getUsers(batch);
      for (const user of users) {
        if (user.email && user.emailVerified) registered.add(normalizeEmail(user.email));
      }
    }
    return reply({ statuses: Object.fromEntries(emails.map((email) => [email, registered.has(email)])) });
  } catch {
    return reply({ error: "No se pudo consultar el estado de los evaluadores." }, 503);
  }
}
