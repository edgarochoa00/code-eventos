import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import type { User } from "firebase/auth";
import { db, storage } from "./firebase";
import { buildFingerprint } from "./similarity";
import type {
  Criterion,
  EvaluationDoc,
  EventDoc,
  FileItem,
  FingerprintDoc,
  Phase,
  PhaseFeedback,
  ProjectDoc,
  ResultRow,
  StaffRole,
  Submission,
} from "./types";
import { DEFAULT_ORIGINALITY, SUPERADMIN_EMAIL } from "./types";
import { DEFAULT_CRITERIA, normalizeEmail, randomCode } from "./utils";

/* ---------- Referencias ---------- */

export const eventRef = (id: string) => doc(db, "events", id);
export const projectsCol = (eventId: string) => collection(db, "events", eventId, "projects");
export const projectRef = (eventId: string, projectId: string) => doc(db, "events", eventId, "projects", projectId);
export const evaluationsCol = (eventId: string) => collection(db, "events", eventId, "evaluations");

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

export function setStaffRole(email: string, role: StaffRole | "user", by: User) {
  const id = normalizeEmail(email);
  if (id === SUPERADMIN_EMAIL) throw new Error("El superadmin no se puede modificar");
  if (role === "user") return deleteDoc(doc(db, "staff", id));
  return setDoc(doc(db, "staff", id), {
    email: id,
    role,
    updatedBy: normalizeEmail(by.email ?? ""),
    updatedAt: serverTimestamp(),
  });
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
  return updateDoc(eventRef(event.id), { [list]: next });
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

export type NewEventInput = {
  name: string;
  description: string;
  institution: string;
  startDate: string;
  endDate: string;
  maxTeamSize: number;
  phases: Record<Phase, boolean>;
};

export async function createEvent(input: NewEventInput, user: User) {
  const email = normalizeEmail(user.email ?? "");
  const data: Omit<EventDoc, "id"> = {
    ...input,
    code: randomCode(),
    ownerId: user.uid,
    ownerEmail: email,
    organizerEmails: [email],
    judgeEmails: [],
    submissions: { prototype: input.phases.prototype, final: false },
    registrationOpen: true,
    judgingOpen: false,
    criteria: DEFAULT_CRITERIA,
    resultsPublished: false,
    results: null,
    originality: DEFAULT_ORIGINALITY,
    createdAt: null,
  };
  const created = await addDoc(collection(db, "events"), { ...data, createdAt: serverTimestamp() });
  return created.id;
}

export function updateEvent(
  eventId: string,
  patch: Partial<Omit<EventDoc, "id" | "ownerId" | "ownerEmail" | "createdAt">>,
) {
  return updateDoc(eventRef(eventId), patch);
}

export async function findEventByCode(code: string) {
  const snap = await getDocs(query(collection(db, "events"), where("code", "==", code.trim().toUpperCase()), limit(1)));
  return snap.empty ? null : snap.docs[0].id;
}

export function saveCriteria(eventId: string, criteria: Criterion[]) {
  return updateDoc(eventRef(eventId), { criteria });
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
  const members = dedupeMembers([{ name: user.displayName ?? "", email: leaderEmail }, ...input.members]);
  const ref = doc(projectsCol(event.id));
  const project: ProjectDoc = {
    ...input,
    id: ref.id,
    eventId: event.id,
    members,
    memberEmails: members.map((m) => m.email),
    leaderId: user.uid,
    leaderEmail,
    prototype: null,
    final: null,
    createdAt: null,
    updatedAt: null,
  };
  const { id: _id, ...data } = project;
  void _id;
  await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await writeFingerprint(project, event);
  return ref.id;
}

export async function updateProjectInfo(event: EventDoc, project: ProjectDoc, input: ProjectInfoInput) {
  const members = dedupeMembers(input.members);
  if (!members.some((m) => m.email === project.leaderEmail)) {
    members.unshift(project.members.find((m) => m.email === project.leaderEmail) ?? { name: "", email: project.leaderEmail });
  }
  const patch = { ...input, members, memberEmails: members.map((m) => m.email) };
  await updateDoc(projectRef(event.id, project.id), { ...patch, updatedAt: serverTimestamp() });
  await writeFingerprint({ ...project, ...patch }, event);
}

export async function saveSubmission(event: EventDoc, project: ProjectDoc, phase: Phase, submission: Submission) {
  await updateDoc(projectRef(event.id, project.id), {
    [phase]: { ...submission, submittedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
  await writeFingerprint({ ...project, [phase]: submission }, event);
}

export async function uploadSubmissionFile(eventId: string, projectId: string, phase: Phase, file: File) {
  const path = `events/${eventId}/projects/${projectId}/${phase}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type || "application/octet-stream" });
  return { path, url: await getDownloadURL(ref) };
}

export async function removeSubmissionFile(file: FileItem) {
  if (file.path) await deleteObject(storageRef(storage, file.path)).catch(() => undefined);
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
  projectId: string,
  phase: Phase,
  user: User,
  scores: Record<string, number>,
  total: number,
  comment: string,
) {
  const id = evaluationId(user.uid, projectId, phase);
  const data: Omit<EvaluationDoc, "id" | "updatedAt"> = {
    eventId: event.id,
    projectId,
    phase,
    judgeId: user.uid,
    judgeEmail: normalizeEmail(user.email ?? ""),
    judgeName: user.displayName ?? "",
    scores,
    total,
    comment: comment.trim(),
  };
  await setDoc(doc(evaluationsCol(event.id), id), { ...data, updatedAt: serverTimestamp() });
}

/* ---------- Resultados ---------- */

export type PhaseStanding = ResultRow & { criteria: Record<string, number>; comments: string[] };

export function computeStandings(
  event: EventDoc,
  projects: ProjectDoc[],
  evaluations: EvaluationDoc[],
): Record<Phase, PhaseStanding[]> {
  const out: Record<Phase, PhaseStanding[]> = { prototype: [], final: [] };
  for (const phase of ["prototype", "final"] as Phase[]) {
    if (!event.phases[phase]) continue;
    for (const p of projects) {
      const evs = evaluations.filter((e) => e.projectId === p.id && e.phase === phase);
      if (!evs.length) continue;
      const criteria: Record<string, number> = {};
      for (const c of event.criteria) {
        const values = evs.map((e) => e.scores[c.id]).filter((v): v is number => typeof v === "number");
        if (values.length) criteria[c.id] = round1(values.reduce((a, b) => a + b, 0) / values.length);
      }
      out[phase].push({
        projectId: p.id,
        title: p.title,
        score: round1(evs.reduce((a, e) => a + e.total, 0) / evs.length),
        judges: evs.length,
        criteria,
        comments: evs.map((e) => e.comment).filter(Boolean),
      });
    }
    out[phase].sort((a, b) => b.score - a.score);
  }
  return out;
}

export async function publishResults(event: EventDoc, projects: ProjectDoc[], evaluations: EvaluationDoc[]) {
  const standings = computeStandings(event, projects, evaluations);
  const batch = writeBatch(db);
  const results: Record<Phase, ResultRow[]> = {
    prototype: standings.prototype.map(({ projectId, title, score, judges }) => ({ projectId, title, score, judges })),
    final: standings.final.map(({ projectId, title, score, judges }) => ({ projectId, title, score, judges })),
  };
  batch.update(eventRef(event.id), { results, resultsPublished: true, judgingOpen: false });

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

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
