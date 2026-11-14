import { handleUserDeletion, UserDeletionError } from "@/lib/server/user-deletion";

export async function POST(request: Request) {
  try {
    return Response.json(await handleUserDeletion(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof UserDeletionError;
    if (!known) console.error("[api/admin/user-deletion]", error);
    return Response.json(
      {
        error: known ? error.message : "No se pudo completar la operación. Intenta de nuevo.",
        ...(known && error.inspection ? { inspection: error.inspection } : {}),
      },
      { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
