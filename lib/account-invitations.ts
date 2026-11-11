export type InvitationScope =
  | { kind: "event"; eventId: string; role: "judge" | "organizer" }
  | { kind: "team"; eventId: string; projectId: string; role: "leader" | "member" }
  | { kind: "staff"; role: "organizer" | "admin" };

export type AccountInvitation = InvitationScope & { email: string };
export type InvitationResult = { status: "sent" | "recently-sent" };

export function invitationProjectPath(path: string | null) {
  return path && /^\/eventos\/[\w-]{1,128}\/proyectos\/[\w-]{1,128}$/.test(path) ? path : null;
}

/** El permiso ya se guardó; un fallo de correo no debe presentarse como un fallo del alta. */
export class SavedInvitationError extends Error {}
