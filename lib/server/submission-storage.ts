import "server-only";

import { createClient } from "@supabase/supabase-js";
import { MAX_FILE_BYTES, MAX_FILE_MB, submissionFileLocation, validDocumentId, validateFileSize } from "../submission-files";
import { SUPERADMIN_EMAIL, type EventDoc, type Phase, type ProjectDoc, type StaffDoc } from "../types";

export class StorageRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const deny = () => new StorageRequestError(403, "No tienes permiso para esta acción (o la etapa está cerrada).");
const emulator = () => process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

type FirestoreValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  nullValue?: null;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

function decode(value: FirestoreValue): unknown {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decode);
  if (value.mapValue) return decodeFields(value.mapValue.fields ?? {});
  return null;
}

function decodeFields(fields: Record<string, FirestoreValue>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

export async function readDocumentSnapshot<T>(path: string, token: string): Promise<{ data: T; updateTime: string } | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new StorageRequestError(503, "Falta configurar Firebase en el servidor.");
  const origin = emulator() ? "http://127.0.0.1:8085" : "https://firestore.googleapis.com";
  // El token del usuario mantiene las reglas de Firestore, incluidas las cuentas suspendidas.
  const response = await fetch(`${origin}/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) throw deny();
  if (!response.ok) throw new StorageRequestError(503, "No se pudieron comprobar los permisos. Intenta de nuevo.");
  const document = await response.json();
  return { data: decodeFields(document.fields ?? {}) as T, updateTime: document.updateTime };
}

export async function readDocument<T>(path: string, token: string): Promise<T | null> {
  return (await readDocumentSnapshot<T>(path, token))?.data ?? null;
}

export async function session(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(header) || header.length > 16384) {
    throw new StorageRequestError(401, "Inicia sesión para acceder a los archivos.");
  }
  const token = header.slice(7);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new StorageRequestError(503, "Falta configurar Firebase en el servidor.");
  const origin = emulator() ? "http://127.0.0.1:9099/identitytoolkit.googleapis.com" : "https://identitytoolkit.googleapis.com";
  const response = await fetch(`${origin}/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (response.status >= 500) throw new StorageRequestError(503, "No se pudo comprobar tu sesión. Intenta de nuevo.");
  if (!response.ok) throw new StorageRequestError(401, "Tu sesión caducó. Vuelve a iniciar sesión.");
  const { users } = await response.json();
  const user = users?.[0];
  if (!user?.localId || !user.email || !user.emailVerified || user.disabled) throw deny();
  return { token, email: user.email.toLowerCase() as string, uid: user.localId as string };
}

async function access(request: Request, eventId: unknown, projectId: unknown, phase: unknown) {
  if (!validDocumentId(eventId) || !validDocumentId(projectId) || (phase !== "prototype" && phase !== "final")) {
    throw new StorageRequestError(400, "La entrega no es válida.");
  }
  const user = await session(request);
  const [project, event, staff] = await Promise.all([
    readDocument<ProjectDoc>(`events/${eventId}/projects/${projectId}`, user.token),
    readDocument<EventDoc>(`events/${eventId}`, user.token),
    readDocument<StaffDoc>(`staff/${encodeURIComponent(user.email)}`, user.token),
  ]);
  if (!event || !project) throw new StorageRequestError(404, "El proyecto ya no está disponible.");
  const isSuperadmin = user.email === SUPERADMIN_EMAIL;
  if (!isSuperadmin && staff?.role === "blocked") throw deny();
  const organizer = isSuperadmin || staff?.role === "admin" || event.organizerEmails.includes(user.email);
  const member = project.memberEmails.includes(user.email);
  if (!organizer && !member && !event.judgeEmails.includes(user.email)) throw deny();
  // Las entregas son del equipo: el organizador puede descargarlas, pero no reemplazarlas.
  const teamMember = member && !organizer && !event.judgeEmails.includes(user.email);
  const canEdit = teamMember && !project.registrationPending && !event.resultsPublished && event.phases[phase] && event.submissions[phase];
  const canDeleteProject = !event.resultsPublished && (organizer || (teamMember && project.leaderId === user.uid && event.registrationOpen));
  return { project, canEdit, canDeleteProject, eventId, projectId, phase: phase as Phase };
}

function storageClient() {
  // Esta clave solo se utiliza en el servidor; nunca lleva el prefijo NEXT_PUBLIC_.
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageRequestError(503, "La subida de archivos aún no está configurada. Contacta al organizador.");
  // Una identidad inventada por el emulador nunca debe autorizar acceso a archivos reales.
  if (emulator() && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
    throw new StorageRequestError(503, "Las pruebas con emuladores requieren Supabase local para no tocar archivos reales.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function privateBucket() {
  const client = storageClient();
  const name = process.env.SUPABASE_STORAGE_BUCKET || "code-submissions";
  // Rechaza buckets públicos o sin límite: protege los archivos incluso con una configuración equivocada.
  const { data, error } = await client.storage.getBucket(name);
  const limit = Number(data?.file_size_limit);
  if (error || !data || data.public || !Number.isSafeInteger(limit) || limit <= 0 || limit > MAX_FILE_BYTES) {
    throw new StorageRequestError(503, `El almacenamiento necesita un bucket privado con límite de ${MAX_FILE_MB} MB. Contacta al organizador.`);
  }
  return client.storage.from(name);
}

export async function handleStorageRequest(request: Request) {
  let body;
  try { body = await request.json(); } catch { throw new StorageRequestError(400, "La solicitud no es válida."); }
  if (!body || typeof body !== "object") throw new StorageRequestError(400, "La solicitud no es válida.");
  const { action } = body;
  if (action === "upload") {
    const scope = await access(request, body.eventId, body.projectId, body.phase);
    if (!scope.canEdit) throw deny();
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 255) throw new StorageRequestError(400, "El nombre del archivo no es válido.");
    try { validateFileSize(body.size); } catch (error) { throw new StorageRequestError(400, (error as Error).message); }
    const name = body.name.replace(/[^\w.-]+/g, "_");
    const path = `events/${scope.eventId}/projects/${scope.projectId}/${scope.phase}/${crypto.randomUUID()}_${name}`;
    const storage = await privateBucket();
    const { data, error } = await storage.createSignedUploadUrl(path, { upsert: false });
    if (error) throw new StorageRequestError(502, "No se pudo preparar la subida. Intenta de nuevo.");
    return { path, signedUrl: data.signedUrl };
  }
  if (!["download", "remove", "discard", "verify"].includes(action)) throw new StorageRequestError(400, "La operación no es válida.");
  const location = submissionFileLocation(body.path);
  if (!location) throw new StorageRequestError(400, "La ruta del archivo no es válida.");
  const scope = await access(request, location.eventId, location.projectId, location.phase);
  const registered = scope.project[scope.phase]?.files.some(file => file.storage === "supabase" && file.path === body.path);
  if (action === "download" && !registered) throw new StorageRequestError(404, "El archivo ya no está en esta entrega.");
  if (action === "discard" && registered) throw new StorageRequestError(409, "El archivo ya está guardado en la entrega.");
  if (action !== "download" && !scope.canEdit && !(action === "remove" && scope.canDeleteProject)) throw deny();
  if (action === "verify") {
    try { validateFileSize(body.size); } catch (error) { throw new StorageRequestError(400, (error as Error).message); }
  }
  const storage = await privateBucket();
  if (action === "download") {
    const { data, error } = await storage.createSignedUrl(body.path, 60);
    if (error) throw new StorageRequestError(404, "El archivo no está disponible. Pide al equipo que lo vuelva a subir.");
    return { signedUrl: data.signedUrl };
  }
  if (action === "verify") {
    const { data, error } = await storage.info(body.path);
    if (error || !data || typeof data.size !== "number" || data.size !== body.size || data.size > MAX_FILE_BYTES) {
      throw new StorageRequestError(400, "El archivo no terminó de subir. Vuelve a seleccionarlo.");
    }
    return { ok: true };
  }
  const { error } = await storage.remove([body.path]);
  if (error) throw new StorageRequestError(502, "No se pudo eliminar el archivo. Intenta de nuevo.");
  return { ok: true };
}
