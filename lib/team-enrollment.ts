export type TeamEnrollmentInput = {
  eventId: string;
  email: string;
};

/** Solo se devuelve la contraseña de cuentas nuevas, una vez, al responsable del alta. */
export type CreatedTeamAccount = { email: string; password: string };
export type TeamEnrollmentResult = { projectId: string; createdAccounts: CreatedTeamAccount[] };
