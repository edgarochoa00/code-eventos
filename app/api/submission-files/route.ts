import { handleStorageRequest, StorageRequestError } from "@/lib/server/submission-storage";

export async function POST(request: Request) {
  try {
    return Response.json(await handleStorageRequest(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof StorageRequestError;
    return Response.json(
      { error: known ? error.message : "No se pudo conectar con el servicio de archivos. Intenta de nuevo." },
      { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
