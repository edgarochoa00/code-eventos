import { handleProjectLogo } from "@/lib/server/project-logo";
import { StorageRequestError } from "@/lib/server/submission-storage";

async function handle(request: Request) {
  try { return await handleProjectLogo(request); } catch (error) {
    const known = error instanceof StorageRequestError;
    return Response.json({ error: known ? error.message : "No se pudo conectar con el servicio de logos. Intenta de nuevo." }, {
      status: known ? error.status : 503, headers: { "Cache-Control": "no-store" },
    });
  }
}

export { handle as GET, handle as POST, handle as DELETE };
