import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminServices } from "./firebase-admin";
import { EnrollmentError } from "./team-enrollment";
import { validDocumentId } from "../submission-files";
import { normalizeEmail } from "../utils";
import { SUPERADMIN_EMAIL, type EventDoc, type ProjectDoc } from "../types";

// El comprobante permite reintentar una baja si Authentication falla después de borrar el proyecto.
export async function handleProjectWithdrawal(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(header) || header.length > 16384) throw new EnrollmentError(401, "Inicia sesión para dar de baja el proyecto.");
  const { auth, db } = adminServices();
  let identity;
  try { identity = await auth.verifyIdToken(header.slice(7), true); }
  catch { throw new EnrollmentError(401, "Tu sesión caducó. Vuelve a iniciar sesión."); }
  if (!identity.email_verified || !identity.email) throw new EnrollmentError(403, "Verifica tu correo primero.");
  const text = await request.text();
  if (text.length > 16384) throw new EnrollmentError(413, "La solicitud es demasiado grande.");
  let input;
  try { input = JSON.parse(text); } catch { throw new EnrollmentError(400, "Solicitud inválida."); }
  if (!input || !validDocumentId(input.eventId) || !validDocumentId(input.projectId)) throw new EnrollmentError(400, "Proyecto inválido.");
  const actor = normalizeEmail(identity.email);
  const eventRef = db.doc(`events/${input.eventId}`);
  const projectRef = eventRef.collection("projects").doc(input.projectId);
  const receiptRef = db.doc(`projectWithdrawals/${input.eventId}_${input.projectId}`);
  await db.runTransaction(async tx => {
    const [eventSnap, projectSnap, staff, receipt, roster, evaluations] = await Promise.all([
      tx.get(eventRef), tx.get(projectRef), tx.get(db.doc(`staff/${actor}`)), tx.get(receiptRef),
      tx.get(eventRef.collection("access").doc("participants")),
      tx.get(eventRef.collection("evaluations").where("projectId", "==", input.projectId)),
    ]);
    const event = eventSnap.data() as EventDoc | undefined;
    const project = projectSnap.data() as ProjectDoc | undefined;
    const organizer = actor === SUPERADMIN_EMAIL || staff.data()?.role === "admin" || event?.organizerEmails.includes(actor);
    if (staff.data()?.role === "blocked" || (!organizer && (project?.leaderId ?? receipt.data()?.actorUid) !== identity.uid)) {
      throw new EnrollmentError(403, "Solo el líder o un organizador de este evento puede darlo de baja.");
    }
    if (!project) {
      if (receipt.exists) return;
      throw new EnrollmentError(404, "El proyecto ya no existe.");
    }
    if (!event || event.resultsPublished || (!organizer && !event.registrationOpen)) throw new EnrollmentError(409, "La baja está cerrada para este evento.");
    if (event.accessVersion !== 1 || !roster.exists) throw new EnrollmentError(409, "El evento necesita actualizar sus permisos.");
    // Se resuelven solo los correos obtenidos del proyecto autorizado, nunca una lista enviada por el cliente.
    const accounts = await Promise.all(project.memberEmails.map(async email => {
      try { return { email, uid: (await auth.getUserByEmail(email)).uid }; }
      catch (error) {
        if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
        const profiles = await tx.get(db.collection("users").where("email", "==", email));
        return { email, uid: profiles.docs[0]?.id ?? "" };
      }
    }));
    const members = { ...roster.data()!.members };
    for (const email of project.memberEmails) delete members[email];
    tx.update(roster.ref, { members, projectId: "" });
    tx.delete(projectRef);
    tx.delete(db.doc(`fingerprints/${input.projectId}`));
    evaluations.docs.forEach(doc => tx.delete(doc.ref));
    tx.create(receiptRef, { actorUid: identity.uid, accounts, completed: false, createdAt: FieldValue.serverTimestamp() });
  });

  const receipt = (await receiptRef.get()).data()!;
  if (receipt.completed) return { deleted: true, accountDeleted: false };
  let accountDeleted = false;
  const accounts = (receipt.accounts as { email: string; uid: string }[]).sort((a, b) => Number(a.uid === identity.uid) - Number(b.uid === identity.uid));
  for (const account of accounts) {
    if (!account.uid || account.email === SUPERADMIN_EMAIL) continue;
    const marker = db.doc(`withdrawnAccounts/${account.uid}`);
    const removable = await db.runTransaction(async tx => {
      const [staff, projects, events] = await Promise.all([
        tx.get(db.doc(`staff/${account.email}`)),
        tx.get(db.collectionGroup("projects").where("memberEmails", "array-contains", account.email)),
        tx.get(db.collection("events")),
      ]);
      if (staff.exists || !projects.empty || events.docs.some(doc => {
        const e = doc.data();
        return e.ownerId === account.uid || e.organizerEmails?.includes(account.email) || e.judgeEmails?.includes(account.email);
      })) return false;
      // Impide que una pestaña con una sesión antigua vuelva a crear el perfil eliminado.
      tx.set(marker, { withdrawnAt: FieldValue.serverTimestamp() });
      tx.delete(db.doc(`users/${account.uid}`));
      return true;
    });
    if (!removable) continue;
    try { await auth.deleteUser(account.uid); }
    catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw new EnrollmentError(503, "El proyecto se dio de baja, pero falta retirar un acceso. Vuelve a intentar la baja para completar la limpieza."); }
    if (account.uid === identity.uid) accountDeleted = true;
  }
  await receiptRef.update({ completed: true, accounts: FieldValue.delete() });
  return { deleted: true, accountDeleted };
}
