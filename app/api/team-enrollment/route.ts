import { EnrollmentError, handleTeamEnrollment } from "@/lib/server/team-enrollment";

export async function POST(request: Request) {
  try {
    return Response.json(await handleTeamEnrollment(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof EnrollmentError;
    return Response.json({ error: known ? error.message : "No se pudo conectar con el servicio de altas. Intenta de nuevo.",
      createdAccounts: known ? error.createdAccounts : [] },
    { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
