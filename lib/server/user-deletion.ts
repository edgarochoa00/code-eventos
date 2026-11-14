import "server-only";

import { createHash } from "node:crypto";
import type { Auth, DecodedIdToken, UserRecord } from "firebase-admin/auth";
import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { isProjectLogoPath } from "../project-logo";
import { computeStandings } from "../results";
import {
  PHASES,
  SUPERADMIN_EMAIL,
  type EvaluationDoc,
  type EventDoc,
  type ParticipantRoster,
  type Phase,
  type PhaseFeedback,
  type ProjectDoc,
  type ResultRow,
  type StaffDoc,
  type StaffRole,
  type UserDoc,
} from "../types";
import type {
  AuthUserSummary,
  EvaluationLink,
  EventRoleLink,
  LedProjectLink,
  MemberProjectLink,
  OwnedEventLink,
  RosterLink,
  UserDeletionInspection,
  UserDeletionResult,
} from "../user-deletion";
import { isEmail, normalizeEmail } from "../utils";
import { invitationDeliveryId, teamInvitationDeliveryId } from "./account-invitations";
import { adminServices, adminStorageBucket } from "./firebase-admin";
import { privateBucket, StorageRequestError } from "./submission-storage";

export class UserDeletionError extends Error {
  constructor(
    public status: number,
    message: string,
    public inspection?: UserDeletionInspection,
  ) {
    super(message);
  }
}

type BatchOp =
  | { type: "delete"; ref: DocumentReference }
  | { type: "update"; ref: DocumentReference; data: Record<string, unknown> };

type DeletionPlan = {
  inspection: UserDeletionInspection;
  authUids: string[];
  ownedEventRefs: DocumentReference[];
  batchOps: BatchOp[];
  supabasePaths: string[];
  firebaseStoragePaths: string[];
};

const MAX_REQUEST_BYTES = 16_384;
const BATCH_CHUNK_SIZE = 400;

function toAuthSummary(user: UserRecord): AuthUserSummary {
  return {
    uid: user.uid,
    email: normalizeEmail(user.email ?? ""),
    displayName: user.displayName ?? "",
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    creationTime: user.metadata.creationTime ?? null,
    lastSignInTime: user.metadata.lastSignInTime ?? null,
    providers: user.providerData.map((provider) => provider.providerId).filter(Boolean),
  };
}

async function requireSuperadmin(request: Request): Promise<{ auth: Auth; db: Firestore; identity: DecodedIdToken }> {
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(header) || header.length > MAX_REQUEST_BYTES) {
    throw new UserDeletionError(401, "Inicia sesión para realizar esta operación.");
  }
  const { auth, db } = adminServices();
  let identity: DecodedIdToken;
  try {
    identity = await auth.verifyIdToken(header.slice(7), true);
  } catch {
    throw new UserDeletionError(401, "Tu sesión caducó. Vuelve a iniciar sesión.");
  }
  if (!identity.email || !identity.email_verified || normalizeEmail(identity.email) !== SUPERADMIN_EMAIL) {
    throw new UserDeletionError(403, "Solo el superadministrador puede eliminar usuarios por completo.");
  }
  return { auth, db, identity };
}

function parseDeletionRequest(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new UserDeletionError(400, "La solicitud no es válida.");
  }
  const body = raw as Record<string, unknown>;
  const allowed = new Set(["action", "email", "uid", "inspectionHash"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new UserDeletionError(400, "La solicitud contiene datos no permitidos.");
  }
  if (body.action !== "inspect" && body.action !== "delete") {
    throw new UserDeletionError(400, "La operación solicitada no es válida.");
  }
  let email = "";
  if (body.email !== undefined && body.email !== "") {
    if (typeof body.email !== "string" || body.email.length > 254 || !isEmail(body.email) || /[\/\s]/.test(body.email.trim())) {
      throw new UserDeletionError(400, "Escribe un correo válido.");
    }
    email = normalizeEmail(body.email);
  }
  let uid = "";
  if (body.uid !== undefined && body.uid !== "") {
    if (typeof body.uid !== "string" || body.uid.trim().length === 0 || body.uid.length > 128 || body.uid.includes("/")) {
      throw new UserDeletionError(400, "El identificador del usuario no es válido.");
    }
    uid = body.uid.trim();
  }
  if (!email && !uid) {
    throw new UserDeletionError(400, "Indica el correo o identificador del usuario.");
  }
  let inspectionHash = "";
  if (body.action === "delete") {
    if (typeof body.inspectionHash !== "string" || !/^[a-f0-9]{64}$/.test(body.inspectionHash)) {
      throw new UserDeletionError(400, "Falta la verificación previa de vínculos.");
    }
    inspectionHash = body.inspectionHash;
  }
  return { action: body.action, email, uid, inspectionHash };
}

function collectProjectStoragePaths(eventId: string, projectId: string, project: ProjectDoc) {
  const supabasePaths: string[] = [];
  const firebaseStoragePaths: string[] = [];
  if (project.logo?.storage === "supabase" && isProjectLogoPath(project.logo.path, eventId, projectId)) {
    supabasePaths.push(project.logo.path);
  }
  for (const phase of PHASES) {
    for (const file of project[phase]?.files ?? []) {
      if (!file.path) continue;
      if (file.storage === "supabase") supabasePaths.push(file.path);
      else firebaseStoragePaths.push(file.path);
    }
  }
  return { supabasePaths, firebaseStoragePaths };
}

function buildResultsUpdate(
  event: EventDoc,
  remainingProjects: Array<{ ref: DocumentReference; data: ProjectDoc }>,
  remainingEvaluations: EvaluationDoc[],
): { results: Record<Phase, ResultRow[]>; projectUpdates: BatchOp[] } {
  const standings = computeStandings(
    { ...event, criteria: Array.isArray(event.criteria) ? event.criteria : [] },
    remainingProjects.map((entry) => entry.data),
    remainingEvaluations,
  );
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
  const projectUpdates: BatchOp[] = [];
  for (const entry of remainingProjects) {
    const feedback: Partial<Record<Phase, PhaseFeedback>> = {};
    for (const phase of PHASES) {
      const idx = standings[phase].findIndex((item) => item.projectId === entry.data.id);
      if (idx === -1) continue;
      const standing = standings[phase][idx];
      feedback[phase] = {
        score: standing.score,
        judges: standing.judges,
        rank: idx + 1,
        of: standings[phase].length,
        comments: standing.comments,
        criteria: standing.criteria,
      };
    }
    if (Object.keys(feedback).length > 0) {
      projectUpdates.push({ type: "update", ref: entry.ref, data: { feedback } });
    } else if (entry.data.feedback && Object.keys(entry.data.feedback).length > 0) {
      projectUpdates.push({ type: "update", ref: entry.ref, data: { feedback: FieldValue.delete() } });
    }
  }
  return { results, projectUpdates };
}

async function resolveIdentity(
  auth: Auth,
  db: Firestore,
  actorUid: string,
  requestedEmail: string,
  requestedUid: string,
) {
  if (requestedEmail === SUPERADMIN_EMAIL || requestedUid === actorUid) {
    throw new UserDeletionError(403, "No puedes eliminar la cuenta del superadministrador.");
  }

  const authMap = new Map<string, UserRecord>();
  if (requestedEmail) {
    try {
      const user = await auth.getUserByEmail(requestedEmail);
      authMap.set(user.uid, user);
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }
  }
  if (requestedUid && !authMap.has(requestedUid)) {
    try {
      const user = await auth.getUser(requestedUid);
      const authEmail = normalizeEmail(user.email ?? "");
      if (requestedEmail && authEmail && authEmail !== requestedEmail) {
        throw new UserDeletionError(400, "El identificador y el correo no corresponden al mismo usuario.");
      }
      authMap.set(user.uid, user);
    } catch (error) {
      if (error instanceof UserDeletionError) throw error;
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }
  }

  let email = requestedEmail;
  if (!email) {
    for (const user of authMap.values()) {
      const candidate = normalizeEmail(user.email ?? "");
      if (candidate) {
        email = candidate;
        break;
      }
    }
  }

  const profileDocs = new Map<string, { ref: DocumentReference; data: UserDoc }>();
  if (requestedUid) {
    const snap = await db.doc(`users/${requestedUid}`).get();
    if (snap.exists) {
      const data = snap.data() as UserDoc;
      const profileEmail = normalizeEmail(data.email ?? "");
      if (email && profileEmail && profileEmail !== email) {
        throw new UserDeletionError(400, "El perfil del usuario no coincide con el correo indicado.");
      }
      if (!email && profileEmail) email = profileEmail;
      profileDocs.set(snap.ref.path, { ref: snap.ref, data });
    }
  }

  if (email) {
    if (email === SUPERADMIN_EMAIL) {
      throw new UserDeletionError(403, "No puedes eliminar la cuenta del superadministrador.");
    }
    const byEmail = await db.collection("users").where("email", "==", email).get();
    for (const snap of byEmail.docs) {
      profileDocs.set(snap.ref.path, { ref: snap.ref, data: snap.data() as UserDoc });
    }
  }

  for (const authUser of authMap.values()) {
    if (normalizeEmail(authUser.email ?? "") === SUPERADMIN_EMAIL || authUser.uid === actorUid) {
      throw new UserDeletionError(403, "No puedes eliminar la cuenta del superadministrador.");
    }
    const ref = db.doc(`users/${authUser.uid}`);
    if (!profileDocs.has(ref.path)) {
      const snap = await ref.get();
      if (snap.exists) profileDocs.set(snap.ref.path, { ref: snap.ref, data: snap.data() as UserDoc });
    }
  }

  const uidSet = new Set<string>(authMap.keys());
  if (requestedUid) uidSet.add(requestedUid);
  for (const entry of profileDocs.values()) {
    const docUid = entry.data.uid || entry.ref.id;
    if (docUid) uidSet.add(docUid);
  }
  if (uidSet.has(actorUid)) {
    throw new UserDeletionError(403, "No puedes eliminar la cuenta del superadministrador.");
  }

  const displayName =
    Array.from(profileDocs.values()).find((item) => item.data.displayName?.trim())?.data.displayName?.trim() ||
    Array.from(authMap.values()).find((item) => item.displayName?.trim())?.displayName?.trim() ||
    "";

  return {
    email,
    displayName,
    uids: Array.from(uidSet).sort(),
    authAccounts: Array.from(authMap.values()).sort((a, b) => a.uid.localeCompare(b.uid)),
    profileRefs: Array.from(profileDocs.values())
      .map((entry) => entry.ref)
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
}

async function getExistingRefs(db: Firestore, refs: DocumentReference[]) {
  if (!refs.length) return [];
  const found: DocumentReference[] = [];
  for (let i = 0; i < refs.length; i += 500) {
    const snapshots = await db.getAll(...refs.slice(i, i + 500));
    for (const snap of snapshots) {
      if (snap.exists) found.push(snap.ref);
    }
  }
  return found;
}

async function buildDeletionPlan(
  auth: Auth,
  db: Firestore,
  actorUid: string,
  requestedEmail: string,
  requestedUid: string,
): Promise<DeletionPlan> {
  const identity = await resolveIdentity(auth, db, actorUid, requestedEmail, requestedUid);
  const { email, uids, authAccounts, profileRefs } = identity;
  const uidSet = new Set(uids);

  const batchOps: BatchOp[] = [];
  const ownedEventRefs: DocumentReference[] = [];
  const supabasePathSet = new Set<string>();
  const firebasePathSet = new Set<string>();

  for (const ref of profileRefs) batchOps.push({ type: "delete", ref });

  // Staff permissions + updatedBy references
  const staffSnap = await db.collection("staff").get();
  let staffRole: StaffRole | null = null;
  let staffUpdatedByCount = 0;
  for (const docSnap of staffSnap.docs) {
    const data = docSnap.data() as StaffDoc;
    const docEmail = normalizeEmail(data.email || docSnap.id);
    if (email && (docSnap.id.toLowerCase() === email || docEmail === email)) {
      staffRole = data.role;
      batchOps.push({ type: "delete", ref: docSnap.ref });
    } else if (email && normalizeEmail(data.updatedBy ?? "") === email) {
      staffUpdatedByCount++;
      batchOps.push({ type: "update", ref: docSnap.ref, data: { updatedBy: "" } });
    }
  }

  // Account-level auxiliary collections keyed by UID
  const limitRefs = await getExistingRefs(
    db,
    uids.map((id) => db.doc(`accountInvitationLimits/${id}`)),
  );
  const withdrawnRefs = await getExistingRefs(
    db,
    uids.map((id) => db.doc(`withdrawnAccounts/${id}`)),
  );
  for (const ref of [...limitRefs, ...withdrawnRefs]) batchOps.push({ type: "delete", ref });

  // Withdrawal receipts referencing UID or email
  const withdrawalDeletePaths = new Set<string>();
  let withdrawalReceiptsCount = 0;
  for (const id of uids) {
    const receiptsByActor = await db.collection("projectWithdrawals").where("actorUid", "==", id).get();
    for (const docSnap of receiptsByActor.docs) {
      if (!withdrawalDeletePaths.has(docSnap.ref.path)) {
        withdrawalDeletePaths.add(docSnap.ref.path);
        withdrawalReceiptsCount++;
        batchOps.push({ type: "delete", ref: docSnap.ref });
      }
    }
  }
  const pendingReceipts = await db.collection("projectWithdrawals").where("completed", "==", false).get();
  for (const docSnap of pendingReceipts.docs) {
    if (withdrawalDeletePaths.has(docSnap.ref.path)) continue;
    const accounts = Array.isArray(docSnap.data().accounts)
      ? (docSnap.data().accounts as Array<{ email?: string; uid?: string }>)
      : [];
    const matches = accounts.some(
      (item) => (item.uid && uidSet.has(item.uid)) || (email && normalizeEmail(item.email ?? "") === email),
    );
    if (!matches) continue;
    withdrawalReceiptsCount++;
    const remaining = accounts.filter(
      (item) => !(item.uid && uidSet.has(item.uid)) && !(email && normalizeEmail(item.email ?? "") === email),
    );
    if (remaining.length === 0) {
      withdrawalDeletePaths.add(docSnap.ref.path);
      batchOps.push({ type: "delete", ref: docSnap.ref });
    } else {
      batchOps.push({ type: "update", ref: docSnap.ref, data: { accounts: remaining } });
    }
  }

  // Events, projects, evaluations, rosters, fingerprints, and team invitation receipts
  const eventRefs = (await db.collection("events").listDocuments()).sort((a, b) => a.id.localeCompare(b.id));
  const ownedEvents: OwnedEventLink[] = [];
  const coOrganizerEvents: EventRoleLink[] = [];
  const judgeEvents: EventRoleLink[] = [];
  const evaluationsByEvent: EvaluationLink[] = [];
  const ledProjects: LedProjectLink[] = [];
  const memberProjects: MemberProjectLink[] = [];
  const orphanRosters: RosterLink[] = [];

  const deliveryCandidates: DocumentReference[] = email
    ? [db.doc(`accountInvitationDeliveries/${invitationDeliveryId(email)}`)]
    : [];
  const deletedProjectReceiptCandidates: DocumentReference[] = [];

  for (const eventRef of eventRefs) {
    const [eventSnap, projectsSnap, evaluationsSnap, rosterSnap] = await Promise.all([
      eventRef.get(),
      eventRef.collection("projects").get(),
      eventRef.collection("evaluations").get(),
      eventRef.collection("access").doc("participants").get(),
    ]);

    if (email) {
      for (const projectDoc of projectsSnap.docs) {
        deliveryCandidates.push(
          db.doc(`accountInvitationDeliveries/${teamInvitationDeliveryId(eventRef.id, projectDoc.id, "leader", email)}`),
          db.doc(`accountInvitationDeliveries/${teamInvitationDeliveryId(eventRef.id, projectDoc.id, "member", email)}`),
        );
      }
    }

    const eventData = eventSnap.exists ? ({ ...eventSnap.data(), id: eventSnap.id } as EventDoc) : null;
    const isOwner = Boolean(
      eventData &&
        ((eventData.ownerId && uidSet.has(eventData.ownerId)) ||
          (email && normalizeEmail(eventData.ownerEmail ?? "") === email)),
    );

    if (isOwner && eventData) {
      ownedEventRefs.push(eventRef);
      ownedEvents.push({
        eventId: eventRef.id,
        name: eventData.name || "Evento sin nombre",
        institution: eventData.institution || "",
        resultsPublished: Boolean(eventData.resultsPublished),
        projectsCount: projectsSnap.size,
        evaluationsCount: evaluationsSnap.size,
      });
      for (const projectDoc of projectsSnap.docs) {
        const project = { ...projectDoc.data(), id: projectDoc.id } as ProjectDoc;
        const paths = collectProjectStoragePaths(eventRef.id, projectDoc.id, project);
        paths.supabasePaths.forEach((path) => supabasePathSet.add(path));
        paths.firebaseStoragePaths.forEach((path) => firebasePathSet.add(path));
        batchOps.push({ type: "delete", ref: db.doc(`fingerprints/${projectDoc.id}`) });
        deletedProjectReceiptCandidates.push(db.doc(`projectWithdrawals/${eventRef.id}_${projectDoc.id}`));
      }
      continue;
    }

    const eventName = eventData?.name || "Evento sin nombre";
    const institution = eventData?.institution || "";

    // Track co-organizer / judge roles on non-owned events
    if (eventData && email) {
      const organizerEmails = eventData.organizerEmails ?? [];
      const nextOrganizers = organizerEmails.filter((item) => normalizeEmail(item) !== email);
      const removedOrganizer = nextOrganizers.length !== organizerEmails.length;
      if (removedOrganizer) {
        coOrganizerEvents.push({
          eventId: eventRef.id,
          name: eventName,
          institution,
          hasJudgeAssignments: false,
          assignedProjectsCount: 0,
        });
      }

      const judgeEmails = eventData.judgeEmails ?? [];
      const nextJudges = judgeEmails.filter((item) => normalizeEmail(item) !== email);
      const removedJudge = nextJudges.length !== judgeEmails.length;

      const assignments = eventData.judgeAssignments ?? {};
      const matchingAssignmentKeys = Object.keys(assignments).filter((key) => normalizeEmail(key) === email);
      const hasAssignmentEntry = matchingAssignmentKeys.length > 0;
      const assignedViaEvent = matchingAssignmentKeys.reduce(
        (count, key) => count + (assignments[key]?.projectIds?.length ?? 0) + (assignments[key]?.categories?.length ?? 0),
        0,
      );
      const projectJudgingHits = projectsSnap.docs.filter((projectDoc) =>
        ((projectDoc.data() as ProjectDoc).judging?.judgeEmails ?? []).some((item) => normalizeEmail(item) === email),
      ).length;

      if (removedJudge || hasAssignmentEntry || projectJudgingHits > 0) {
        judgeEvents.push({
          eventId: eventRef.id,
          name: eventName,
          institution,
          hasJudgeAssignments: hasAssignmentEntry || projectJudgingHits > 0,
          assignedProjectsCount: assignedViaEvent + projectJudgingHits,
        });
      }

      if (removedOrganizer || removedJudge || hasAssignmentEntry) {
        const updateData: Record<string, unknown> = {};
        if (removedOrganizer) updateData.organizerEmails = nextOrganizers;
        if (removedJudge) updateData.judgeEmails = nextJudges;
        if (hasAssignmentEntry) {
          const nextAssignments = { ...assignments };
          for (const key of matchingAssignmentKeys) delete nextAssignments[key];
          updateData.judgeAssignments = Object.keys(nextAssignments).length > 0 ? nextAssignments : FieldValue.delete();
        }
        batchOps.push({ type: "update", ref: eventRef, data: updateData });
      }
    }

    // Scan projects in this event
    const deletedProjectIds = new Set<string>();
    const rosterKeysToDelete = new Set<string>();
    const projectTitlesById = new Map<string, string>();
    const remainingProjects: Array<{ ref: DocumentReference; data: ProjectDoc }> = [];
    const evalsByProjectId = new Map<string, number>();

    for (const evalDoc of evaluationsSnap.docs) {
      const evalData = evalDoc.data() as EvaluationDoc;
      evalsByProjectId.set(evalData.projectId, (evalsByProjectId.get(evalData.projectId) ?? 0) + 1);
    }

    for (const projectDoc of projectsSnap.docs) {
      const project = { ...projectDoc.data(), id: projectDoc.id } as ProjectDoc;
      projectTitlesById.set(projectDoc.id, project.title || "Proyecto sin título");

      const isLeader =
        (project.leaderId && uidSet.has(project.leaderId)) ||
        (email !== "" && normalizeEmail(project.leaderEmail ?? "") === email);

      const isMember =
        !isLeader &&
        email !== "" &&
        ((project.memberEmails ?? []).some((item) => normalizeEmail(item) === email) ||
          (project.members ?? []).some((member) => normalizeEmail(member.email ?? "") === email));

      if (isLeader) {
        deletedProjectIds.add(projectDoc.id);
        const paths = collectProjectStoragePaths(eventRef.id, projectDoc.id, project);
        paths.supabasePaths.forEach((path) => supabasePathSet.add(path));
        paths.firebaseStoragePaths.forEach((path) => firebasePathSet.add(path));
        for (const memberEmail of project.memberEmails ?? []) {
          const normalized = normalizeEmail(memberEmail);
          if (normalized) rosterKeysToDelete.add(normalized);
        }
        if (email) rosterKeysToDelete.add(email);

        ledProjects.push({
          eventId: eventRef.id,
          eventName,
          projectId: projectDoc.id,
          title: project.title || (project.registrationPending ? "Registro pendiente" : "Proyecto sin título"),
          registrationPending: Boolean(project.registrationPending),
          resultsPublished: Boolean(eventData?.resultsPublished),
          otherMembers: (project.memberEmails ?? []).map(normalizeEmail).filter((item) => item && item !== email),
          filesCount: (project.prototype?.files?.length ?? 0) + (project.final?.files?.length ?? 0),
          hasLogo: Boolean(project.logo),
          evaluationsCount: evalsByProjectId.get(projectDoc.id) ?? 0,
        });

        batchOps.push({ type: "delete", ref: projectDoc.ref });
        batchOps.push({ type: "delete", ref: db.doc(`fingerprints/${projectDoc.id}`) });
        deletedProjectReceiptCandidates.push(db.doc(`projectWithdrawals/${eventRef.id}_${projectDoc.id}`));
        continue;
      }

      const updatedProject: ProjectDoc = { ...project };
      const projectPatch: Record<string, unknown> = {};

      if (isMember) {
        rosterKeysToDelete.add(email);
        memberProjects.push({
          eventId: eventRef.id,
          eventName,
          projectId: projectDoc.id,
          title: project.title || "Proyecto sin título",
          leaderEmail: project.leaderEmail || "",
        });
        const nextMemberEmails = (project.memberEmails ?? []).filter((item) => normalizeEmail(item) !== email);
        const nextMembers = (project.members ?? []).filter((member) => normalizeEmail(member.email ?? "") !== email);
        updatedProject.memberEmails = nextMemberEmails;
        updatedProject.members = nextMembers;
        projectPatch.memberEmails = nextMemberEmails;
        projectPatch.members = nextMembers;
      }

      if (email && project.prototype && normalizeEmail(project.prototype.submittedBy ?? "") === email) {
        updatedProject.prototype = { ...project.prototype, submittedBy: "" };
        projectPatch.prototype = updatedProject.prototype;
      }
      if (email && project.final && normalizeEmail(project.final.submittedBy ?? "") === email) {
        updatedProject.final = { ...project.final, submittedBy: "" };
        projectPatch.final = updatedProject.final;
      }
      if (email && project.judging?.judgeEmails?.some((item) => normalizeEmail(item) === email)) {
        const nextJudging = {
          ...project.judging,
          judgeEmails: project.judging.judgeEmails.filter((item) => normalizeEmail(item) !== email),
        };
        updatedProject.judging = nextJudging;
        projectPatch.judging = nextJudging;
      }

      if (Object.keys(projectPatch).length > 0) {
        batchOps.push({ type: "update", ref: projectDoc.ref, data: projectPatch });
      }
      remainingProjects.push({ ref: projectDoc.ref, data: updatedProject });
    }

    // Scan evaluations in this event (user's own evaluations OR evaluations belonging to a deleted led project)
    const userEvalPhases = new Set<string>();
    const userEvalProjectTitles = new Set<string>();
    let userEvalCount = 0;
    let deletedAnyEvalInEvent = false;
    const remainingEvaluations: EvaluationDoc[] = [];

    for (const evalDoc of evaluationsSnap.docs) {
      const evalData = { ...evalDoc.data(), id: evalDoc.id } as EvaluationDoc;
      const authoredByUser =
        (evalData.judgeId && uidSet.has(evalData.judgeId)) ||
        (email !== "" && normalizeEmail(evalData.judgeEmail ?? "") === email);
      const forDeletedProject = deletedProjectIds.has(evalData.projectId);

      if (authoredByUser) {
        userEvalCount++;
        userEvalPhases.add(evalData.phase);
        userEvalProjectTitles.add(projectTitlesById.get(evalData.projectId) ?? evalData.projectId);
      }

      if (authoredByUser || forDeletedProject) {
        deletedAnyEvalInEvent = true;
        batchOps.push({ type: "delete", ref: evalDoc.ref });
      } else {
        remainingEvaluations.push(evalData);
      }
    }

    if (userEvalCount > 0) {
      evaluationsByEvent.push({
        eventId: eventRef.id,
        eventName,
        resultsPublished: Boolean(eventData?.resultsPublished),
        evaluationsCount: userEvalCount,
        phases: Array.from(userEvalPhases).sort(),
        projectTitles: Array.from(userEvalProjectTitles).sort(),
      });
    }

    // Update participant roster if needed
    if (rosterSnap.exists) {
      const roster = rosterSnap.data() as ParticipantRoster;
      const existingMemberKeys = Object.keys(roster.members ?? {});
      const keysToRemove = existingMemberKeys.filter((key) => {
        const normalized = normalizeEmail(key);
        return rosterKeysToDelete.has(normalized) || (email !== "" && normalized === email);
      });
      const userOnlyInRoster =
        email !== "" &&
        existingMemberKeys.some((key) => normalizeEmail(key) === email) &&
        !ledProjects.some((item) => item.eventId === eventRef.id) &&
        !memberProjects.some((item) => item.eventId === eventRef.id);

      if (userOnlyInRoster) {
        orphanRosters.push({ eventId: eventRef.id, eventName });
      }

      const resetProjectId = Boolean(roster.projectId && deletedProjectIds.has(roster.projectId));
      if (keysToRemove.length > 0 || resetProjectId) {
        const nextMembers = { ...(roster.members ?? {}) };
        for (const key of keysToRemove) delete nextMembers[key];
        batchOps.push({
          type: "update",
          ref: rosterSnap.ref,
          data: {
            members: nextMembers,
            ...(resetProjectId ? { projectId: "" } : {}),
          },
        });
      }
    }

    // Keep published standings & feedback consistent if any project or evaluation was removed
    if (eventData?.resultsPublished && (deletedAnyEvalInEvent || deletedProjectIds.size > 0)) {
      const { results, projectUpdates } = buildResultsUpdate(eventData, remainingProjects, remainingEvaluations);
      batchOps.push({ type: "update", ref: eventRef, data: { results } });
      batchOps.push(...projectUpdates);
    }
  }

  const existingDeliveries = await getExistingRefs(db, deliveryCandidates);
  for (const ref of existingDeliveries) batchOps.push({ type: "delete", ref });

  const existingProjectReceipts = await getExistingRefs(
    db,
    deletedProjectReceiptCandidates.filter((ref) => !withdrawalDeletePaths.has(ref.path)),
  );
  for (const ref of existingProjectReceipts) {
    withdrawalDeletePaths.add(ref.path);
    withdrawalReceiptsCount++;
    batchOps.push({ type: "delete", ref });
  }

  const supabasePaths = Array.from(supabasePathSet).sort();
  const firebaseStoragePaths = Array.from(firebasePathSet).sort();

  const hasLinks =
    staffRole !== null ||
    ownedEvents.length > 0 ||
    coOrganizerEvents.length > 0 ||
    judgeEvents.length > 0 ||
    evaluationsByEvent.length > 0 ||
    ledProjects.length > 0 ||
    memberProjects.length > 0 ||
    orphanRosters.length > 0;

  const existsAnywhere =
    hasLinks ||
    authAccounts.length > 0 ||
    profileRefs.length > 0 ||
    staffUpdatedByCount > 0 ||
    existingDeliveries.length > 0 ||
    limitRefs.length > 0 ||
    withdrawnRefs.length > 0 ||
    withdrawalReceiptsCount > 0 ||
    supabasePaths.length + firebaseStoragePaths.length > 0;

  const mergedBatchOps = coalesceBatchOperations(batchOps);

  const records = {
    authAccounts: authAccounts.map(toAuthSummary),
    userProfilesCount: profileRefs.length,
    staffRole,
    staffUpdatedByCount,
    invitationDeliveriesCount: existingDeliveries.length,
    invitationLimitsCount: limitRefs.length,
    withdrawnMarkersCount: withdrawnRefs.length,
    withdrawalReceiptsCount,
    storageFilesCount: supabasePaths.length + firebaseStoragePaths.length,
  };
  const links = {
    staffRole,
    ownedEvents,
    coOrganizerEvents,
    judgeEvents,
    evaluationsByEvent,
    ledProjects,
    memberProjects,
    orphanRosters,
  };
  const target = {
    email,
    displayName: identity.displayName,
    uids,
  };

  const canonicalSnapshot = {
    target,
    records,
    links,
    ownedEventIds: ownedEventRefs.map((ref) => ref.id).sort(),
    ops: mergedBatchOps
      .map((op) => ({
        type: op.type,
        path: op.ref.path,
        keys: op.type === "update" ? Object.keys(op.data).sort() : [],
      }))
      .sort((a, b) => a.path.localeCompare(b.path) || a.type.localeCompare(b.type)),
    supabasePaths,
    firebaseStoragePaths,
  };
  const inspectionHash = createHash("sha256").update(JSON.stringify(canonicalSnapshot)).digest("hex");

  return {
    inspection: {
      target,
      existsAnywhere,
      hasLinks,
      inspectionHash,
      records,
      links,
    },
    authUids: authAccounts.map((item) => item.uid),
    ownedEventRefs,
    batchOps: mergedBatchOps,
    supabasePaths,
    firebaseStoragePaths,
  };
}

function coalesceBatchOperations(operations: BatchOp[]): BatchOp[] {
  const byPath = new Map<string, BatchOp>();
  for (const op of operations) {
    const path = op.ref.path;
    const existing = byPath.get(path);
    if (!existing) {
      byPath.set(path, op.type === "update" ? { ...op, data: { ...op.data } } : op);
      continue;
    }
    if (op.type === "delete" || existing.type === "delete") {
      byPath.set(path, { type: "delete", ref: op.ref });
      continue;
    }
    byPath.set(path, {
      type: "update",
      ref: op.ref,
      data: { ...existing.data, ...op.data },
    });
  }
  return Array.from(byPath.values());
}

async function deleteStorageFiles(supabasePaths: string[], firebasePaths: string[]) {
  if (supabasePaths.length > 0) {
    let bucket;
    try {
      bucket = await privateBucket();
    } catch (error) {
      if (error instanceof StorageRequestError) throw new UserDeletionError(error.status, error.message);
      throw new UserDeletionError(503, "No se pudo conectar con el almacenamiento de archivos. Intenta de nuevo.");
    }
    for (let i = 0; i < supabasePaths.length; i += 100) {
      const { error } = await bucket.remove(supabasePaths.slice(i, i + 100));
      if (error) {
        throw new UserDeletionError(502, "No se pudieron eliminar los archivos del usuario en Supabase. Intenta de nuevo.");
      }
    }
  }

  if (
    firebasePaths.length > 0 &&
    process.env.NEXT_PUBLIC_ENABLE_STORAGE === "true" &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  ) {
    const bucket = adminStorageBucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    await Promise.all(firebasePaths.map((filePath) => bucket.file(filePath).delete({ ignoreNotFound: true })));
  }
}

async function commitBatchOperations(db: Firestore, operations: BatchOp[]) {
  for (let i = 0; i < operations.length; i += BATCH_CHUNK_SIZE) {
    const batch = db.batch();
    for (const op of operations.slice(i, i + BATCH_CHUNK_SIZE)) {
      if (op.type === "delete") batch.delete(op.ref);
      else batch.update(op.ref, op.data);
    }
    await batch.commit();
  }
}

export async function handleListAuthUsers(request: Request) {
  const { auth } = await requireSuperadmin(request);
  const users: AuthUserSummary[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      users.push(toAuthSummary(user));
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return { users };
}

export async function handleUserDeletion(request: Request): Promise<UserDeletionInspection | UserDeletionResult> {
  const { auth, db, identity } = await requireSuperadmin(request);
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) {
    throw new UserDeletionError(413, "La solicitud es demasiado grande.");
  }
  const text = await request.text();
  if (text.length > MAX_REQUEST_BYTES) {
    throw new UserDeletionError(413, "La solicitud es demasiado grande.");
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new UserDeletionError(400, "La solicitud no es válida.");
  }
  const input = parseDeletionRequest(body);
  const plan = await buildDeletionPlan(auth, db, identity.uid, input.email, input.uid);

  if (input.action === "inspect") {
    return plan.inspection;
  }

  if (plan.inspection.inspectionHash !== input.inspectionHash) {
    throw new UserDeletionError(
      409,
      "Los registros o vínculos del usuario cambiaron mientras revisabas la información. Verifica la lista actualizada.",
      plan.inspection,
    );
  }

  await deleteStorageFiles(plan.supabasePaths, plan.firebaseStoragePaths);

  await commitBatchOperations(db, plan.batchOps);
  for (const eventRef of plan.ownedEventRefs) {
    await db.recursiveDelete(eventRef);
  }

  let removedAuthAccounts = 0;
  for (const uid of plan.authUids) {
    try {
      await auth.revokeRefreshTokens(uid);
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") {
        throw new UserDeletionError(
          503,
          "Se limpiaron los registros de Firebase, pero falló la desconexión en Authentication. Intenta de nuevo para completar el borrado.",
        );
      }
    }
    try {
      await auth.deleteUser(uid);
      removedAuthAccounts++;
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") {
        throw new UserDeletionError(
          503,
          "Se limpiaron los registros de Firebase, pero falló la eliminación en Authentication. Intenta de nuevo para completar el borrado.",
        );
      }
    }
  }

  const ownedDocsCount = plan.inspection.links.ownedEvents.reduce(
    (sum, item) => sum + 1 + item.projectsCount + item.evaluationsCount,
    0,
  );
  const removedBatchDocs = plan.batchOps.filter((op) => op.type === "delete").length;
  const updatedBatchDocs = plan.batchOps.filter((op) => op.type === "update").length;

  return {
    deleted: true,
    email: plan.inspection.target.email,
    removedAuthAccounts,
    removedFirestoreDocs: removedBatchDocs + ownedDocsCount,
    updatedFirestoreDocs: updatedBatchDocs,
    removedStorageFiles: plan.supabasePaths.length + plan.firebaseStoragePaths.length,
  };
}
