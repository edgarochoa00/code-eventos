// Ejecuta el servicio real con Firebase y Supabase simulados; nunca conecta a la nube.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import { handleStorageRequest, StorageRequestError } from "../lib/server/submission-storage";
import {
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  submissionFileLocation,
  validateFileSize,
  validateSubmissionFiles,
} from "../lib/submission-files";
import type { FileItem } from "../lib/types";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { stringValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

function fields(data: Record<string, Json>) {
  return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, encode(item)]));
}

function encode(data: Json): FirestoreValue {
  if (data === null) return { nullValue: null };
  if (typeof data === "string") return { stringValue: data };
  if (typeof data === "boolean") return { booleanValue: data };
  if (typeof data === "number") return { integerValue: String(data) };
  if (Array.isArray(data)) return { arrayValue: { values: data.map(encode) } };
  return { mapValue: { fields: fields(data) } };
}

const path = "events/e1/projects/p1/prototype/one.pdf";
const upload = { action: "upload", eventId: "e1", projectId: "p1", phase: "prototype", name: "one.pdf", size: 100 };
const storedFile: FileItem = { name: "one.pdf", size: 100, type: "application/pdf", sha256: "0".repeat(64), storage: "supabase", path };
const testEnv = {
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-code",
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-key",
  SUPABASE_URL: "https://storage.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  SUPABASE_STORAGE_BUCKET: "code-submissions",
  NODE_ENV: "development",
  NEXT_PUBLIC_USE_EMULATORS: "false",
};
const originalEnv = Object.fromEntries(Object.keys(testEnv).map(key => [key, process.env[key]]));
let email: string;
let role: string | undefined;
let verified: boolean;
let open: boolean;
let registrationOpen: boolean;
let publicBucket: boolean;
let bucketLimit: number | null;
let objectSize: number;
let storageCalls: number;
let projectForbidden: boolean;
let memberEmails: string[];
let resultsPublished: boolean;

const response = (body: unknown, status = 200) => Response.json(body, { status });
const fakeFetch: typeof fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : input.toString();
  if (url.includes("accounts:lookup")) {
    return response({ users: [{ localId: email.split("@")[0], email, emailVerified: verified }] });
  }
  if (url.includes("/documents/events/e1/projects/p1")) {
    if (projectForbidden) return response({}, 403);
    return response({ fields: fields({
      memberEmails, leaderId: "member",
      prototype: { files: [{ storage: "supabase", path }] }, final: null,
    }) });
  }
  if (url.includes("/documents/events/e1")) {
    return response({ fields: fields({
      organizerEmails: ["organizer@example.test"], judgeEmails: ["judge@example.test"],
      phases: { prototype: true, final: true }, submissions: { prototype: open, final: false }, registrationOpen, resultsPublished,
    }) });
  }
  if (url.includes("/documents/staff/")) return role ? response({ fields: fields({ role }) }) : response({}, 404);
  storageCalls++;
  if (url.endsWith("/bucket/code-submissions")) {
    return response({ id: "code-submissions", name: "code-submissions", public: publicBucket, file_size_limit: bucketLimit });
  }
  if (url.includes("/object/upload/sign/")) {
    return response({ url: "/object/upload/sign/code-submissions/one.pdf?token=test-upload-token" });
  }
  if (url.includes("/object/sign/")) return response({ signedURL: "/object/sign/code-submissions/one.pdf?token=test-download-token" });
  if (url.includes("/object/info/")) return response({ size: objectSize });
  if (url.endsWith("/object/code-submissions") && init?.method === "DELETE") return response([]);
  throw new Error(`Solicitud no simulada: ${url}`);
};

function call(body: unknown, token = "firebase-test-token") {
  return handleStorageRequest(new Request("http://localhost/api/submission-files", {
    method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
  }));
}

async function rejects(body: unknown, status: number, token?: string) {
  await assert.rejects(call(body, token), error => error instanceof StorageRequestError && error.status === status);
}

describe("permisos y almacenamiento de entregas", { concurrency: false }, () => {
  before(() => { mock.method(globalThis, "fetch", fakeFetch); });
  beforeEach(() => {
    Object.assign(process.env, testEnv);
    email = "member@example.test";
    role = undefined;
    verified = true;
    open = true;
    registrationOpen = false;
    publicBucket = false;
    bucketLimit = MAX_FILE_BYTES;
    objectSize = 100;
    storageCalls = 0;
    projectForbidden = false;
    memberEmails = ["member@example.test"];
    resultsPublished = false;
  });
  after(() => {
    mock.restoreAll();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test("rechaza solicitudes sin sesión", async () => {
    await rejects(upload, 401, "");
    assert.equal(storageCalls, 0);
  });
  test("rechaza cuentas con correo sin verificar", async () => {
    verified = false;
    await rejects(upload, 403);
    assert.equal(storageCalls, 0);
  });
  test("rechaza cuentas suspendidas aunque pertenezcan al equipo", async () => {
    role = "blocked";
    await rejects({ action: "download", path }, 403);
    assert.equal(storageCalls, 0);
  });
  test("rechaza personas ajenas al evento y proyecto", async () => {
    email = "outsider@example.test";
    await rejects({ action: "download", path }, 403);
    await rejects(upload, 403);
    assert.equal(storageCalls, 0);
  });
  test("respeta una denegación de las reglas de Firestore", async () => {
    projectForbidden = true;
    await rejects({ action: "download", path }, 403);
    assert.equal(storageCalls, 0);
  });
  test("el juez descarga archivos registrados pero no sube ni elimina", async () => {
    email = "judge@example.test";
    await rejects(upload, 403);
    await rejects({ action: "remove", path }, 403);
    const result = await call({ action: "download", path });
    assert.match(result.signedUrl!, /test-download-token/);
  });
  test("un integrante sube en su etapa abierta y obtiene una ruta del proyecto", async () => {
    const result = await call(upload);
    assert.match(result.path!, /^events\/e1\/projects\/p1\/prototype\/[a-f\d-]+_one\.pdf$/);
    assert.match(result.signedUrl!, /test-upload-token/);
  });
  test("un integrante no sube ni elimina cuando la etapa está cerrada", async () => {
    open = false;
    await rejects(upload, 403);
    await rejects({ action: "remove", path }, 403);
  });
  test("el líder puede eliminar archivos al borrar su proyecto durante el registro", async () => {
    open = false;
    registrationOpen = true;
    assert.deepEqual(await call({ action: "remove", path }), { ok: true });
    await rejects(upload, 403);
  });
  test("el organizador no reemplaza entregas, pero puede retirar archivos al borrar un proyecto", async () => {
    email = "organizer@example.test";
    open = true;
    await rejects(upload, 403);
    assert.match((await call({ action: "download", path })).signedUrl!, /test-download-token/);
    assert.deepEqual(await call({ action: "remove", path }), { ok: true });
  });
  test("el admin global descarga archivos sin ser organizador del evento, pero no los reemplaza", async () => {
    email = "admin@example.test";
    role = "admin";
    open = true;
    await rejects(upload, 403);
    assert.match((await call({ action: "download", path })).signedUrl!, /test-download-token/);
  });
  test("los roles antiguos mezclados no permiten reemplazar entregas", async () => {
    for (const account of ["organizer@example.test", "judge@example.test", "admin@example.test"]) {
      email = account;
      memberEmails = [account];
      role = account.startsWith("admin") ? "admin" : undefined;
      await rejects(upload, 403);
    }
    assert.equal(storageCalls, 0);
  });
  test("publicar resultados congela subidas y borrados aunque las etapas sigan abiertas", async () => {
    registrationOpen = true;
    resultsPublished = true;
    await rejects(upload, 403);
    await rejects({ action: "remove", path }, 403);
    email = "organizer@example.test";
    await rejects({ action: "remove", path }, 403);
    assert.equal(storageCalls, 0);
  });
  test("rechaza rutas inválidas y archivos ajenos a la entrega registrada", async () => {
    await rejects({ ...upload, eventId: "../e1" }, 400);
    await rejects({ action: "download", path: path.replace("one.pdf", "unregistered.pdf") }, 404);
    assert.equal(storageCalls, 0);
  });
  test("rechaza archivos superiores a 30 MB antes de contactar Storage", async () => {
    await rejects({ ...upload, size: MAX_FILE_BYTES + 1 }, 400);
    assert.equal(storageCalls, 0);
  });
  test("verifica que el tamaño almacenado coincida con el declarado", async () => {
    assert.deepEqual(await call({ action: "verify", path, size: 100 }), { ok: true });
    objectSize = 101;
    await rejects({ action: "verify", path, size: 100 }, 400);
    await rejects({ action: "verify", path, size: 0 }, 400);
  });
  test("el descarte por fallo nunca borra un archivo ya guardado", async () => {
    await rejects({ action: "discard", path }, 409);
    assert.equal(storageCalls, 0);
  });
  test("rechaza buckets públicos, sin límite o con límite superior a 30 MB", async () => {
    publicBucket = true;
    await rejects({ action: "download", path }, 503);
    publicBucket = false;
    for (const limit of [null, 0, MAX_FILE_BYTES + 1]) {
      bucketLimit = limit;
      await rejects({ action: "download", path }, 503);
    }
  });
  test("los emuladores nunca autorizan acceso a Supabase remoto", async () => {
    process.env.NEXT_PUBLIC_USE_EMULATORS = "true";
    await rejects({ action: "download", path }, 503);
    assert.equal(storageCalls, 0);
  });
});

describe("validación compartida de archivos", () => {
  test("acepta exactamente 30 MB y rechaza tamaños inválidos o superiores", () => {
    assert.equal(MAX_FILE_MB, 30);
    assert.equal(MAX_FILE_BYTES, 30 * 1024 * 1024);
    assert.doesNotThrow(() => validateFileSize(MAX_FILE_BYTES));
    for (const size of [0, -1, 1.5, NaN, Infinity, MAX_FILE_BYTES + 1]) {
      assert.throws(() => validateFileSize(size));
    }
  });
  test("reconoce rutas válidas y rechaza recorridos fuera de la entrega", () => {
    assert.deepEqual(submissionFileLocation(path), { eventId: "e1", projectId: "p1", phase: "prototype" });
    assert.equal(submissionFileLocation("events/e1/projects/p1/prototype/../secret.pdf"), null);
    assert.equal(submissionFileLocation("events/e1/projects/p1/prototype/.."), null);
  });
  test("solo admite archivos subidos al proyecto y fase correspondientes", () => {
    assert.doesNotThrow(() => validateSubmissionFiles("e1", "p1", "prototype", [storedFile]));
    assert.throws(() => validateSubmissionFiles("e1", "other", "prototype", [storedFile]));
    assert.throws(() => validateSubmissionFiles("e1", "p1", "final", [storedFile]));
    assert.throws(() => validateSubmissionFiles("e1", "p1", "prototype", [storedFile, storedFile]));
    assert.throws(() => validateSubmissionFiles("e1", "p1", "prototype", []));
    assert.throws(() => validateSubmissionFiles("e1", "p1", "prototype", [{ ...storedFile, storage: undefined }]));
  });
});
