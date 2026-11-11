export type TeamEnrollmentInput = {
  eventId: string;
  email: string;
};

export type TeamEnrollmentResult = { projectId: string; invitation: "sent" | "recently-sent" | "failed" };
