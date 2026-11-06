export type InvitationScope =
  | { kind: "event"; eventId: string; role: "judge" | "organizer" }
  | { kind: "staff"; role: "organizer" | "admin" };

export type AccountInvitation = InvitationScope & { email: string };
export type InvitationResult = { status: "sent" | "recently-sent" };

/** El permiso ya se guardó; un fallo de correo no debe presentarse como un fallo del alta. */
export class SavedInvitationError extends Error {}
