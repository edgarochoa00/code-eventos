import "server-only";

import sharp from "sharp";
import { isProjectLogoPath, MAX_LOGO_BYTES, validateLogoFile } from "../project-logo";
import { validDocumentId } from "../submission-files";
import { SUPERADMIN_EMAIL, type EventDoc, type ProjectDoc, type ProjectLogo, type StaffDoc } from "../types";
import { privateBucket, readDocument, readDocumentSnapshot, session, StorageRequestError } from "./submission-storage";

const denied = () => new StorageRequestError(403, "Solo el líder puede cambiar el logo mientras el proyecto permite ediciones.");

async function access(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  const projectId = url.searchParams.get("projectId");
  if (!validDocumentId(eventId) || !validDocumentId(projectId)) throw new StorageRequestError(400, "El proyecto no es válido.");
  const user = await session(request);
  const documentPath = `events/${eventId}/projects/${projectId}`;
  const [snapshot, event, staff] = await Promise.all([
    readDocumentSnapshot<ProjectDoc>(documentPath, user.token),
    readDocument<EventDoc>(`events/${eventId}`, user.token),
    readDocument<StaffDoc>(`staff/${encodeURIComponent(user.email)}`, user.token),
  ]);
  if (!snapshot || !event) throw new StorageRequestError(404, "El proyecto ya no está disponible.");
  const project = snapshot.data;
  const superadmin = user.email === SUPERADMIN_EMAIL;
  if (!superadmin && staff?.role === "blocked") throw denied();
  const organizer = superadmin || staff?.role === "admin" || event.organizerEmails.includes(user.email);
  const judge = event.judgeEmails.includes(user.email);
  const member = project.memberEmails.includes(user.email);
  if (!organizer && !judge && !member) throw denied();
  const leader = member && !organizer && !judge && project.leaderId === user.uid;
  const canEdit = leader && !project.registrationPending && !event.resultsPublished
    && (event.registrationOpen || event.submissions.prototype || event.submissions.final);
  const canDeleteProject = !event.resultsPublished && (organizer || (leader && event.registrationOpen));
  return { eventId, projectId, documentPath, user, snapshot, canEdit, canDeleteProject };
}

type Scope = Awaited<ReturnType<typeof access>>;

async function saveLogo(scope: Scope, logo: ProjectLogo | null) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
  const emulator = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
  const origin = emulator ? "http://127.0.0.1:8085" : "https://firestore.googleapis.com";
  // El token del alumno aplica las reglas actuales; la precondición evita pisar otra edición.
  const database = `projects/${projectId}/databases/(default)/documents`;
  const value = logo ? { mapValue: { fields: { path: { stringValue: logo.path }, storage: { stringValue: "supabase" } } } } : { nullValue: null };
  const response = await fetch(`${origin}/v1/${database}:commit`, {
    method: "POST", headers: { Authorization: `Bearer ${scope.user.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ writes: [{
      update: { name: `${database}/${scope.documentPath}`, fields: { logo: value } },
      updateMask: { fieldPaths: ["logo"] },
      updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { updateTime: scope.snapshot.updateTime },
    }] }), cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401 || response.status === 403) throw denied();
  const failedPrecondition = response.status === 400 && (await response.json()).error?.status === "FAILED_PRECONDITION";
  if (failedPrecondition || response.status === 409 || response.status === 412) throw new StorageRequestError(409, "El proyecto cambió. Vuelve a intentar guardar el logo.");
  if (!response.ok) throw new StorageRequestError(503, "No se pudo guardar el logo. Intenta de nuevo.");
}

async function imageFile(request: Request) {
  // Limita los bytes reales, incluso si Content-Length falta o es falso.
  const maxBody = MAX_LOGO_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > maxBody) throw new StorageRequestError(413, "El logo debe pesar como máximo 2 MB.");
  if (!request.body) throw new StorageRequestError(400, "Selecciona un logo.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBody) {
        await reader.cancel();
        throw new StorageRequestError(413, "El logo debe pesar como máximo 2 MB.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch { throw new StorageRequestError(400, "Selecciona un logo PNG, JPG o WebP."); }
  const file = form.get("file");
  if (!(file instanceof File)) throw new StorageRequestError(400, "Selecciona un logo.");
  try { validateLogoFile(file); } catch (error) { throw new StorageRequestError(400, (error as Error).message); }
  return file;
}

export async function normalizeLogo(file: File) {
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("format");
    // Conserva el fondo transparente, aplica orientación y elimina metadatos del original.
    return await image.autoOrient().resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  } catch { throw new StorageRequestError(400, "La imagen no es válida. Elige un PNG, JPG o WebP sin animación de hasta 16 megapíxeles."); }
}

export async function handleProjectLogo(request: Request): Promise<Response> {
  const scope = await access(request);
  const oldPath = scope.snapshot.data.logo?.path;
  const validOldPath = isProjectLogoPath(oldPath, scope.eventId, scope.projectId) ? oldPath : null;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (request.method === "GET") {
    if (!validOldPath) throw new StorageRequestError(404, "Este proyecto aún no tiene logo.");
    const storage = await privateBucket();
    const { data, error } = await storage.download(validOldPath);
    if (error || !data) throw new StorageRequestError(404, "El logo no está disponible. Intenta de nuevo.");
    return new Response(await data.arrayBuffer(), { headers: { ...headers, "Content-Type": "image/webp" } });
  }
  const cleanup = request.method === "DELETE" && new URL(request.url).searchParams.get("cleanup") === "1";
  if (cleanup ? !scope.canDeleteProject : !scope.canEdit) throw denied();
  if (request.method === "DELETE") {
    const storage = validOldPath ? await privateBucket() : null;
    if (!cleanup) await saveLogo(scope, null);
    // La referencia se quita primero: un error de limpieza no deja un logo roto en pantalla.
    if (validOldPath && storage) {
      await storage.remove([validOldPath]).then(({ error }) => {
        if (error) console.error("No se pudo limpiar el logo retirado de Supabase.");
      }).catch(() => console.error("No se pudo limpiar el logo retirado de Supabase."));
    }
    return Response.json({ ok: true }, { headers });
  }
  if (request.method !== "POST") throw new StorageRequestError(405, "La operación no es válida.");
  const file = await imageFile(request);
  const bytes = await normalizeLogo(file);
  const path = `events/${scope.eventId}/projects/${scope.projectId}/logo/${crypto.randomUUID()}.webp`;
  const storage = await privateBucket();
  const { error } = await storage.upload(path, bytes, { contentType: "image/webp", upsert: false });
  if (error) throw new StorageRequestError(502, "No se pudo subir el logo. Intenta de nuevo.");
  const logo: ProjectLogo = { path, storage: "supabase" };
  try { await saveLogo(scope, logo); } catch (error) {
    // No borra el archivo previo si falla el guardado del nuevo.
    // Si se perdió la respuesta, Firestore pudo haber guardado: conservar el objeto evita romperlo.
    if (error instanceof StorageRequestError && error.status >= 400 && error.status < 500) {
      await storage.remove([path]).catch(() => undefined);
    }
    throw error;
  }
  if (validOldPath) {
    await storage.remove([validOldPath]).then(({ error }) => {
      if (error) console.error("No se pudo limpiar el logo anterior de Supabase.");
    }).catch(() => console.error("No se pudo limpiar el logo anterior de Supabase."));
  }
  return Response.json({ logo }, { headers });
}
