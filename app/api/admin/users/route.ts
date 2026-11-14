import { handleListAuthUsers, UserDeletionError } from "@/lib/server/user-deletion";

export async function GET(request: Request) {
  try {
    return Response.json(await handleListAuthUsers(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof UserDeletionError;
    return Response.json(
      { error: known ? error.message : "No se pudieron cargar las cuentas de Authentication." },
      { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
