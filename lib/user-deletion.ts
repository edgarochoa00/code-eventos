import type { StaffRole } from "./types";

export type AuthUserSummary = {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  disabled: boolean;
  creationTime: string | null;
  lastSignInTime: string | null;
  providers: string[];
};

export type OwnedEventLink = {
  eventId: string;
  name: string;
  institution: string;
  resultsPublished: boolean;
  projectsCount: number;
  evaluationsCount: number;
};

export type EventRoleLink = {
  eventId: string;
  name: string;
  institution: string;
  hasJudgeAssignments: boolean;
  assignedProjectsCount: number;
};

export type EvaluationLink = {
  eventId: string;
  eventName: string;
  resultsPublished: boolean;
  evaluationsCount: number;
  phases: string[];
  projectTitles: string[];
};

export type LedProjectLink = {
  eventId: string;
  eventName: string;
  projectId: string;
  title: string;
  registrationPending: boolean;
  resultsPublished: boolean;
  otherMembers: string[];
  filesCount: number;
  hasLogo: boolean;
  evaluationsCount: number;
};

export type MemberProjectLink = {
  eventId: string;
  eventName: string;
  projectId: string;
  title: string;
  leaderEmail: string;
};

export type RosterLink = {
  eventId: string;
  eventName: string;
};

export type UserDeletionInspection = {
  target: {
    email: string;
    displayName: string;
    uids: string[];
  };
  existsAnywhere: boolean;
  hasLinks: boolean;
  inspectionHash: string;
  records: {
    authAccounts: AuthUserSummary[];
    userProfilesCount: number;
    staffRole: StaffRole | null;
    staffUpdatedByCount: number;
    invitationDeliveriesCount: number;
    invitationLimitsCount: number;
    withdrawnMarkersCount: number;
    withdrawalReceiptsCount: number;
    storageFilesCount: number;
  };
  links: {
    staffRole: StaffRole | null;
    ownedEvents: OwnedEventLink[];
    coOrganizerEvents: EventRoleLink[];
    judgeEvents: EventRoleLink[];
    evaluationsByEvent: EvaluationLink[];
    ledProjects: LedProjectLink[];
    memberProjects: MemberProjectLink[];
    orphanRosters: RosterLink[];
  };
};

export type UserDeletionResult = {
  deleted: true;
  email: string;
  removedAuthAccounts: number;
  removedFirestoreDocs: number;
  updatedFirestoreDocs: number;
  removedStorageFiles: number;
};

export class UserDeletionConflictError extends Error {
  constructor(
    message: string,
    public inspection: UserDeletionInspection,
  ) {
    super(message);
  }
}
