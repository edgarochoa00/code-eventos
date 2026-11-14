import { handleProjectWithdrawal } from "@/lib/server/project-withdrawal";
import { EnrollmentError } from "@/lib/server/team-enrollment";

export async function POST(request: Request) {
  try {
    return Response.json(await handleProjectWithdrawal(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof EnrollmentError ? error.message : "No se pudo completar la baja. Intenta de nuevo." },
      { status: error instanceof EnrollmentError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
