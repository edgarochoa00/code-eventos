import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Transaction,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { auth, db } from "./firebase";
import { inviteSavedAccounts, sendInvitations } from "./account-invitation-client";
import { scheduleError } from "./judging-agenda";
import { projectJudgesError } from "./project-judges";
import type { JudgeAssignment } from "./types";
import { categoryCriteriaError, cleanCriteria, criteriaError, deliverySettingsError, evaluationScoresError, getCategoryCriteria, sameCriteria } from "./event-config";
import { computeStandings } from "./results";
import { validateSubmissionFiles } from "./submission-files";
import { removeSubmissionFile, verifySubmissionFiles } from "./submission-storage";
import { projectLogoRequest } from "./project-logo-storage";
import { buildFingerprint } from "./similarity";
import type {
  Criterion,
  EvaluationDoc,
  EventDoc,
  FingerprintDoc,
  Phase,
  PhaseDetails,
  PhaseFeedback,
  ParticipantRoster,
  ProjectDoc,
  ResultRow,
  StaffRole,
  Submission,
} from "./types";
import { DEFAULT_ORIGINALITY, SUPERADMIN_EMAIL } from "./types";
import {
  weightedTotal,
  isProjectAssignedToJudge,
  normalizeEmail,
  randomCode,
} from "./utils";

export { computeStandings } from "./results";
export type { PhaseStanding } from "./results";

/* ---------- Referencias ---------- */

export const eventRef = (id: string) => doc(db, "events", id);
export const projectsCol = (eventId: string) => collection(db, "events", eventId, "projects");
export const projectRef = (eventId: string, projectId: string) => doc(db, "events", eventId, "projects", projectId);
export const evaluationsCol = (eventId: string) => collection(db, "events", eventId, "evaluations");
export const participantRosterRef = (eventId: string) => doc(db, "events", eventId, "access", "participants");

export const evaluationId = (judgeId: string, projectId: string, phase: Phase) => `${judgeId}_${projectId}_${phase}`;

export const qOrganizerEvents = (email: string) =>
  query(collection(db, "events"), where("organizerEmails", "array-contains", normalizeEmail(email)));
export const qJudgeEvents = (email: string) =>
  query(collection(db, "events"), where("judgeEmails", "array-contains", normalizeEmail(email)));
export const qOpenEvents = () => query(collection(db, "events"), where("registrationOpen", "==", true), limit(30));
export const qMyProjects = (email: string) =>
  query(collectionGroup(db, "projects"), where("memberEmails", "array-contains", normalizeEmail(email)));
export const qMyEventProject = (eventId: string, email: string) =>
  query(projectsCol(eventId), where("memberEmails", "array-contains", normalizeEmail(email)));
export const qMyEvaluations = (eventId: string, uid: string) =>
  query(evaluationsCol(eventId), where("judgeId", "==", uid));

/* Solo admins (las reglas lo restringen) */
export const qAllEvents = () => query(collection(db, "events"));
export const qAllUsers = () => query(collection(db, "users"));
export const qAllStaff = () => query(collection(db, "staff"));
export const qAllProjects = () => query(collectionGroup(db, "projects"));

/* ---------- Permisos globales (solo superadmin) ---------- */

export async function setStaffRole(email: string, role: StaffRole | "user", by: User) {
  const id = normalizeEmail(email);
  if (id === SUPERADMIN_EMAIL) throw new Error("El superadmin no se puede modificar");
  if (role === "user") return deleteDoc(doc(db, "staff", id));
  await setDoc(doc(db, "staff", id), {
    email: id,
    role,
    updatedBy: normalizeEmail(by.email ?? ""),
    updatedAt: serverTimestamp(),
  });
  if (role === "organizer" || role === "admin") await inviteSavedAccounts({ kind: "staff", role }, [id]);
}

/** Agrega o quita un correo de la lista de jueces/organizadores de un evento. */
export function setEventMembership(
  event: EventDoc,
  email: string,
  list: "judgeEmails" | "organizerEmails",
  add: boolean,
) {
  const id = normalizeEmail(email);
  const current = event[list];
  const next = add ? Array.from(new Set([...current, id])) : current.filter((e) => e !== id);
  return saveEventEmails(event, list, next);
}

/**
 * Guarda la lista completa de jueces u organizadores de un evento.
 * Quien concursa en el evento (integrante de un proyecto) no puede ser juez ni organizador.
 */
export async function saveEventEmails(event: EventDoc, list: "judgeEmails" | "organizerEmails", emails: string[]) {
  const requested = Array.from(new Set(emails.map(normalizeEmail).filter(Boolean)));
  const removed = event[list].filter((email) => !requested.includes(email));
  const added = requested.filter((email) => !event[list].includes(email));
  const newlyAdded = await runTransaction(db, async (tx) => {
    const [eventSnap, rosterSnap] = await Promise.all([tx.get(eventRef(event.id)), tx.get(participantRosterRef(event.id))]);
    if (!eventSnap.exists()) throw new Error("El evento ya no existe.");
    if (!rosterSnap.exists()) throw new Error("El superadmin debe actualizar los permisos de este evento antes de cambiar sus roles.");
    const current = eventSnap.data() as EventDoc;
    // Aplica solo el cambio solicitado; conserva invitaciones concurrentes.
    const next = Array.from(new Set([...current[list].filter((email) => !removed.includes(email)), ...added]));
    const other = list === "judgeEmails" ? current.organizerEmails : current.judgeEmails;
    const overlap = next.find((email) => other.includes(email));
    if (overlap) throw new Error(`${overlap} ya es ${list === "judgeEmails" ? "organizador" : "juez"}. Quita ese rol antes de asignarle otro.`);
    const members = (rosterSnap.data() as ParticipantRoster).members;
    const contestant = next.find((email) => members[email]);
    if (contestant) throw new Error(`${contestant} participa en un equipo y no puede administrar ni calificar este evento.`);
    if (list === "organizerEmails" && !next.includes(current.ownerEmail)) throw new Error("No se puede quitar al creador del evento.");
    tx.update(eventRef(event.id), { [list]: next });
    return added.filter((email) => !current[list].includes(email));
  });
  await inviteSavedAccounts({ kind: "event", eventId: event.id, role: list === "judgeEmails" ? "judge" : "organizer" }, newlyAdded);
}

export async function saveJudgeAssignment(eventId: string, email: string, assignment: JudgeAssignment) {
  const error = scheduleError(assignment.schedule);
  if (error) throw new Error(error);
  const key = normalizeEmail(email);
  await runTransaction(db, async tx => {
    const snap = await tx.get(eventRef(eventId));
    if (!snap.exists() || !(snap.data() as EventDoc).judgeEmails.includes(key)) throw new Error("El juez ya no pertenece al evento.");
    const next = { ...((snap.data() as EventDoc).judgeAssignments ?? {}), [key]: assignment };
    tx.update(eventRef(eventId), { judgeAssignments: next });
  });
}

export async function saveProjectJudges(eventId: string, projectId: string, judging: NonNullable<ProjectDoc["judging"]>) {
  const next = { maxJudges: judging.maxJudges, judgeEmails: judging.judgeEmails.map(normalizeEmail) };
  await runTransaction(db, async tx => {
    const [eventSnap, projectSnap] = await Promise.all([tx.get(eventRef(eventId)), tx.get(projectRef(eventId, projectId))]);
    if (!eventSnap.exists() || !projectSnap.exists()) throw new Error("El evento o proyecto ya no existe.");
    const error = projectJudgesError(eventSnap.data() as EventDoc, projectSnap.data() as ProjectDoc, next);
    if (error) throw new Error(error);
    tx.update(projectRef(eventId, projectId), { judging: next });
  });
}

/** Actualización única de eventos antiguos. No cambia proyectos, roles ni calificaciones. */
export async function prepareEventAccess(eventId: string) {
  await runTransaction(db, async (tx) => {
    const event = await tx.get(eventRef(eventId));
    if (!event.exists()) throw new Error("El evento ya no existe.");
    if (event.data().accessVersion === 1) return;
    // Las reglas impiden cambiar equipos de eventos antiguos hasta crear esta proyección.
    const projects = await getDocs(projectsCol(eventId));
    const members: Record<string, true> = {};
    for (const project of projects.docs) {
      for (const email of (project.data() as ProjectDoc).memberEmails) {
        if (members[email]) throw new Error(`${email} está en varios equipos. Corrige esa duplicidad antes de actualizar los permisos.`);
        members[email] = true;
      }
    }
    tx.set(participantRosterRef(eventId), { members, projectId: "" } satisfies ParticipantRoster);
    tx.update(eventRef(eventId), { accessVersion: 1 });
  });
}

/** Actualiza las claves sin leer ni revelar el registro privado al equipo. */
function syncParticipants(tx: Transaction, eventId: string, projectId: string, before: string[], after: string[]) {
  const fields: unknown[] = [];
  for (const email of before) if (!after.includes(email)) fields.push(new FieldPath("members", email), deleteField());
  for (const email of after) if (!before.includes(email)) fields.push(new FieldPath("members", email), true);
  tx.update(participantRosterRef(eventId), "projectId", projectId, ...fields);
}

/** Lanza un error si alguno de los correos es juez u organizador del evento. */
function assertNotEventStaff(event: EventDoc, memberEmails: string[]) {
  const staff = new Set([...event.organizerEmails, ...event.judgeEmails].map(normalizeEmail));
  const conflict = memberEmails.find((e) => staff.has(normalizeEmail(e)));
  if (conflict) {
    const role = event.judgeEmails.map(normalizeEmail).includes(conflict) ? "juez" : "organizador";
    throw new Error(`${conflict} es ${role} de este evento y no puede formar parte de un equipo.`);
  }
}

/* ---------- Usuarios ---------- */

export async function upsertUserProfile(user: User) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      email: normalizeEmail(user.email ?? ""),
      displayName: user.displayName ?? "",
      photoURL: user.photoURL ?? "",
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/* ---------- Eventos ---------- */

export type EventSettingsInput = {
  name: string;
  description: string;
  institution: string;
  startDate: string;
  endDate: string;
  maxTeamSize: number;
  phases: Record<Phase, boolean>;
  phaseDetails: Partial<Record<Phase, PhaseDetails>>;
  categories?: string[];
  categoryCriteria?: Record<string, Criterion[]>;
};

export type NewEventInput = EventSettingsInput & { criteria: Criterion[] };

export async function generateUniqueEventCode() {
  for (let i = 0; i < 8; i++) {
    const candidate = randomCode();
    const existing = await findEventByCode(candidate);
    if (!existing) return candidate;
  }
  return randomCode(8);
}

export async function createEvent(input: NewEventInput, user: User) {
  const error = deliverySettingsError(input) ?? criteriaError(input.criteria) ?? categoryCriteriaError(input.categoryCriteria ?? {});
  if (error) throw new Error(error);
  const email = normalizeEmail(user.email ?? "");
  const code = await generateUniqueEventCode();
  const data: Omit<EventDoc, "id"> = {
    ...input,
    accessVersion: 1,
    categories: input.categories?.length ? input.categories : ["General"],
    code,
    ownerId: user.uid,
    ownerEmail: email,
    organizerEmails: [email],
    judgeEmails: [],
    submissions: { ...input.phases },
    registrationOpen: true,
    judgingOpen: false,
    criteria: cleanCriteria(input.criteria),
    ...(input.categoryCriteria ? { categoryCriteria: Object.fromEntries(Object.entries(input.categoryCriteria).map(([category, criteria]) => [category, cleanCriteria(criteria)])) } : {}),
    resultsPublished: false,
    results: null,
    originality: DEFAULT_ORIGINALITY,
    createdAt: null,
  };
  const created = doc(collection(db, "events"));
  const batch = writeBatch(db);
  batch.set(created, { ...data, createdAt: serverTimestamp() });
  batch.set(participantRosterRef(created.id), { members: {}, projectId: "" } satisfies ParticipantRoster);
  await batch.commit();
  return created.id;
}

export async function updateEvent(
  eventId: string,
  patch: Partial<Omit<EventDoc, "id" | "ownerId" | "ownerEmail" | "createdAt" | "accessVersion" | "judgeEmails" | "organizerEmails">>,
) {
  if (typeof patch.judgingOpen === "boolean") {
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(eventRef(eventId));
      if (!snapshot.exists()) throw new Error("El evento ya no existe.");
      transaction.update(eventRef(eventId), {
        ...patch,
        categoryLocked: Boolean(patch.judgingOpen || snapshot.data().judgingOpen || snapshot.data().categoryLocked),
      });
    });
  }
  return updateDoc(eventRef(eventId), patch);
}

export async function deleteEvent(eventId: string) {
  const event = await getDoc(eventRef(eventId));
  if (!event.exists()) return;
  const user = auth.currentUser;
  if (!user || (user.uid !== event.data().ownerId && normalizeEmail(user.email ?? "") !== SUPERADMIN_EMAIL)) {
    throw new Error("Solo el creador o el superadmin pueden eliminar el evento.");
  }
  if (event.data().resultsPublished) throw new Error("Oculta los resultados antes de eliminar el evento.");
  if (event.data().accessVersion !== 1) throw new Error("Actualiza los permisos del evento antes de eliminarlo.");
  const projects = await getDocs(projectsCol(eventId));
  for (const project of projects.docs) await deleteProject(eventId, { ...project.data(), id: project.id } as ProjectDoc, true);
  const evaluations = await getDocs(evaluationsCol(eventId));
  for (let i = 0; i < evaluations.docs.length; i += 400) {
    const batch = writeBatch(db);
    evaluations.docs.slice(i, i + 400).forEach((evaluation) => batch.delete(evaluation.ref));
    await batch.commit();
  }
  const batch = writeBatch(db);
  batch.delete(participantRosterRef(eventId));
  batch.delete(eventRef(eventId));
  await batch.commit();
}

export async function findEventByCode(code: string) {
  const snap = await getDocs(query(collection(db, "events"), where("code", "==", code.trim().toUpperCase()), limit(1)));
  return snap.empty ? null : snap.docs[0].id;
}

export async function saveCategoryCriteria(eventId: string, category: string, criteria: Criterion[]) {
  const error = categoryCriteriaError({ [category]: criteria });
  if (error) throw new Error(error);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(eventRef(eventId));
    if (!snapshot.exists()) throw new Error("El evento ya no existe.");
    if (snapshot.data().resultsPublished) throw new Error("Oculta los resultados antes de cambiar una rúbrica.");
    // FieldPath conserva nombres como «Hardware / IoT» o «Diseño 2.0» sin crear rutas anidadas.
    transaction.update(eventRef(eventId), new FieldPath("categoryCriteria", category), cleanCriteria(criteria));
  });
}

/* ---------- Proyectos ---------- */

export type ProjectInfoInput = Pick<
  ProjectDoc,
  "title" | "summary" | "problem" | "solution" | "technologies" | "category" | "members"
>;

async function writeFingerprint(project: ProjectDoc, event: EventDoc) {
  const fp = await buildFingerprint(project, event.name);
  await setDoc(doc(db, "fingerprints", project.id), { ...fp, updatedAt: serverTimestamp() });
}

export async function createProject(event: EventDoc, input: ProjectInfoInput, user: User) {
  const leaderEmail = normalizeEmail(user.email ?? "");
  const members = dedupeMembers([{ name: input.members.find((member) => member.email === leaderEmail)?.name || user.displayName || "", email: leaderEmail }, ...input.members]);
  const memberEmails = members.map((m) => m.email);
  assertNotEventStaff(event, memberEmails);
  const ref = doc(projectsCol(event.id));
  const project: ProjectDoc = {
    ...input,
    id: ref.id,
    eventId: event.id,
    members,
    memberEmails,
    leaderId: user.uid,
    leaderEmail,
    prototype: null,
    final: null,
    createdAt: null,
    updatedAt: null,
  };
  const { id: _id, ...data } = project;
  void _id;
  await runTransaction(db, async (tx) => {
    const currentEvent = await tx.get(eventRef(event.id));
    if (!currentEvent.exists()) throw new Error("El evento ya no existe.");
    if (currentEvent.data().accessVersion !== 1) throw new Error("El superadmin debe actualizar los permisos de este evento antes de registrar equipos.");
    assertNotEventStaff(currentEvent.data() as EventDoc, memberEmails);
    tx.set(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    syncParticipants(tx, event.id, ref.id, [], memberEmails);
  });
  await writeFingerprint(project, event);
  const failedInvitations = await sendInvitations({ kind: "team", role: "member", eventId: event.id, projectId: ref.id },
    memberEmails.filter((email) => email !== leaderEmail));
  return { id: ref.id, failedInvitations };
}

export async function updateProjectInfo(event: EventDoc, project: ProjectDoc, input: ProjectInfoInput, user: User) {
  const { updated, added } = await runTransaction(db, async (tx) => {
    const [projectSnap, eventSnap] = await Promise.all([tx.get(projectRef(event.id, project.id)), tx.get(eventRef(event.id))]);
    if (!projectSnap.exists() || !eventSnap.exists()) throw new Error("El proyecto ya no existe.");
    const current = { ...projectSnap.data(), id: project.id } as ProjectDoc;
    const isLeader = user.uid === current.leaderId;
    if (current.registrationPending && !isLeader) throw new Error("Solo el líder puede completar el registro del proyecto.");
    // Solo el líder administra a los integrantes; los demás conservan la lista actual.
    const members = isLeader ? dedupeMembers(input.members) : [...current.members];
    if (!members.some((m) => m.email === current.leaderEmail)) {
      members.unshift(current.members.find((m) => m.email === current.leaderEmail) ?? { name: "", email: current.leaderEmail });
    }
    const memberEmails = members.map((m) => m.email);
    assertNotEventStaff(eventSnap.data() as EventDoc, memberEmails);
    const changedMembers = memberEmails.length !== current.memberEmails.length || memberEmails.some((email, index) => current.memberEmails[index] !== email);
    if (changedMembers && eventSnap.data().accessVersion !== 1) throw new Error("El superadmin debe actualizar los permisos de este evento antes de cambiar integrantes.");
    const completion = current.registrationPending ? { registrationPending: false } : {};
    const patch = isLeader ? { ...input, ...completion, members, memberEmails } : { ...input, members: current.members };
    tx.update(projectRef(event.id, project.id), { ...patch, updatedAt: serverTimestamp() });
    if (changedMembers) syncParticipants(tx, event.id, project.id, current.memberEmails, memberEmails);
    const added = memberEmails.filter((email) => email !== current.leaderEmail && !current.memberEmails.includes(email));
    return { updated: { ...current, ...patch }, added };
  });
  await writeFingerprint(updated, event);
  return sendInvitations({ kind: "team", role: "member", eventId: event.id, projectId: project.id }, added);
}

export async function deleteProject(eventId: string, project: ProjectDoc, asOrganizer = false) {
  const event = await getDoc(eventRef(eventId));
  if (!event.exists()) throw new Error("El evento ya no existe.");
  if (event.data().resultsPublished) throw new Error("Oculta los resultados antes de eliminar proyectos.");
  if (event.data().accessVersion !== 1) throw new Error("El superadmin debe actualizar los permisos antes de eliminar proyectos.");
  const evaluations = asOrganizer ? (await getDocs(query(evaluationsCol(eventId), where("projectId", "==", project.id)))).docs : [];
  const files = [...(project.prototype?.files ?? []), ...(project.final?.files ?? [])];
  if (project.logo) await projectLogoRequest(eventId, project.id, "DELETE", undefined, true);
  await Promise.all(files.map(file => removeSubmissionFile(file)));
  await runTransaction(db, async (tx) => {
    const current = await tx.get(projectRef(eventId, project.id));
    if (!current.exists()) return;
    tx.delete(current.ref);
    syncParticipants(tx, eventId, project.id, (current.data() as ProjectDoc).memberEmails, []);
    evaluations.forEach((evaluation) => tx.delete(evaluation.ref));
  });
}

export async function saveSubmission(event: EventDoc, project: ProjectDoc, phase: Phase, submission: Submission) {
  validateSubmissionFiles(event.id, project.id, phase, submission.files);
  if (submission.links.length) throw new Error("Las entregas se realizan con archivos subidos directamente.");
  await verifySubmissionFiles(submission.files);
  await updateDoc(projectRef(event.id, project.id), {
    [phase]: { ...submission, submittedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
  // Un fallo posterior no debe presentar como fallida una entrega que Firestore ya guardó.
  await writeFingerprint({ ...project, [phase]: submission }, event).catch(() => undefined);
  const removed = (project[phase]?.files ?? []).filter(file => file.path && !submission.files.some(current => current.path === file.path));
  await Promise.allSettled(removed.map(file => removeSubmissionFile(file)));
}

function dedupeMembers(members: { name: string; email: string }[]) {
  const seen = new Set<string>();
  return members
    .map((m) => ({ name: m.name.trim(), email: normalizeEmail(m.email) }))
    .filter((m) => m.email && !seen.has(m.email) && seen.add(m.email));
}

/* ---------- Huellas (anti-plagio) ---------- */

export async function loadAllFingerprints() {
  const snap = await getDocs(collection(db, "fingerprints"));
  return snap.docs.map((d) => d.data() as FingerprintDoc);
}

/* ---------- Evaluaciones ---------- */

export async function saveEvaluation(
  event: EventDoc,
  project: Pick<ProjectDoc, "id" | "category">,
  phase: Phase,
  user: User,
  scores: Record<string, number>,
  comment: string,
) {
  const projectId = project.id;
  return runTransaction(db, async (transaction) => {
    const [eventSnap, projectSnap] = await Promise.all([transaction.get(eventRef(event.id)), transaction.get(projectRef(event.id, projectId))]);
    if (!eventSnap.exists() || !projectSnap.exists()) throw new Error("El proyecto ya no existe.");
    const current = { ...eventSnap.data(), id: event.id } as EventDoc;
    const currentProject = { ...projectSnap.data(), id: projectId } as ProjectDoc;
    if (current.accessVersion !== 1 || !current.judgingOpen || current.resultsPublished) throw new Error("La evaluación está cerrada.");
    if (!current.phases[phase] || !isProjectAssignedToJudge(current, currentProject, user.email ?? "")) {
      throw new Error("Este proyecto o etapa no está asignado a tu evaluación.");
    }
    const criteria = getCategoryCriteria(current, currentProject.category);
    if (currentProject.category !== project.category || !sameCriteria(criteria, getCategoryCriteria(event, project.category))) {
      throw new Error("La categoría o su rúbrica cambió. Recarga el proyecto antes de guardar.");
    }
    const error = evaluationScoresError(criteria, scores);
    if (error) throw new Error(error);
    const id = evaluationId(user.uid, projectId, phase);
    const data: Omit<EvaluationDoc, "id" | "updatedAt"> = {
      eventId: event.id,
      projectId,
      phase,
      judgeId: user.uid,
      judgeEmail: normalizeEmail(user.email ?? ""),
      judgeName: user.displayName ?? "",
      scores,
      total: weightedTotal(criteria, scores),
      comment: comment.trim(),
    };
    transaction.set(doc(evaluationsCol(event.id), id), { ...data, updatedAt: serverTimestamp() });
  });
}

export function deleteEvaluation(eventId: string, evalId: string) {
  return deleteDoc(doc(evaluationsCol(eventId), evalId));
}

/* ---------- Resultados ---------- */

export async function publishResults(event: EventDoc, projects: ProjectDoc[], evaluations: EvaluationDoc[]) {
  const standings = computeStandings(event, projects, evaluations);
  const batch = writeBatch(db);
  const results: Record<Phase, ResultRow[]> = {
    prototype: standings.prototype.map(({ projectId, title, category, score, judges }) => ({
      projectId,
      title,
      ...(category ? { category } : {}),
      score,
      judges,
    })),
    final: standings.final.map(({ projectId, title, category, score, judges }) => ({
      projectId,
      title,
      ...(category ? { category } : {}),
      score,
      judges,
    })),
  };
  batch.update(eventRef(event.id), { results, resultsPublished: true, judgingOpen: false, categoryLocked: true });

  for (const p of projects) {
    const feedback: Partial<Record<Phase, PhaseFeedback>> = {};
    for (const phase of ["prototype", "final"] as Phase[]) {
      const idx = standings[phase].findIndex((s) => s.projectId === p.id);
      if (idx === -1) continue;
      const s = standings[phase][idx];
      feedback[phase] = {
        score: s.score,
        judges: s.judges,
        rank: idx + 1,
        of: standings[phase].length,
        comments: s.comments,
        criteria: s.criteria,
      };
    }
    batch.update(projectRef(event.id, p.id), { feedback });
  }
  await batch.commit();
}

export function unpublishResults(eventId: string) {
  return updateDoc(eventRef(eventId), { resultsPublished: false });
}
