// Ejecuta el servicio real y el decodificador de imágenes sin conectar con servicios remotos.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, mock, test } from "node:test";
import sharp from "sharp";
import { isProjectLogoPath, MAX_LOGO_BYTES, validateLogoFile } from "../lib/project-logo";
import { handleProjectLogo, normalizeLogo } from "../lib/server/project-logo";
import { StorageRequestError } from "../lib/server/submission-storage";

const oldPath = "events/e1/projects/p1/logo/11111111-1111-4111-8111-111111111111.webp";
const env = {
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-code", NEXT_PUBLIC_FIREBASE_API_KEY: "test-key",
  SUPABASE_URL: "https://storage.example.test", SUPABASE_SERVICE_ROLE_KEY: "test-key",
  SUPABASE_STORAGE_BUCKET: "code-submissions", NODE_ENV: "development", NEXT_PUBLIC_USE_EMULATORS: "false",
};
const originalEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
let email: string, uid: string, role: string | null;
let verified: boolean, pending: boolean, published: boolean, open: boolean, publicBucket: boolean;
let patchStatus: number, uploadFails: boolean, deleteFails: boolean;
let patchLost: boolean;
let storageCalls: number;
let storedPath: string | null;
let uploaded: string[], removed: string[];
let savedLogo: unknown;
let png: Buffer;

function encode(value: unknown): unknown {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: fields(value as Record<string, unknown>) } };
}
function fields(data: Record<string, unknown>) { return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)])); }
const json = (body: unknown, status = 200) => Response.json(body, { status });

const fakeFetch: typeof fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : input.toString();
  if (url.includes("accounts:lookup")) return json({ users: [{ localId: uid, email, emailVerified: verified }] });
  if (url.endsWith("/documents:commit")) {
    assert.equal(init?.method, "POST");
    const [write] = JSON.parse(init!.body as string).writes;
    assert.equal(write.currentDocument.updateTime, "2026-11-05T00:00:00Z");
    assert.deepEqual(write.updateMask.fieldPaths, ["logo"]);
    assert.deepEqual(write.updateTransforms, [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }]);
    assert.equal(write.update.name, "projects/demo-code/databases/(default)/documents/events/e1/projects/p1");
    savedLogo = write.update.fields.logo;
    if (patchLost) throw new Error("La respuesta se perdió");
    return json({}, patchStatus);
  }
  if (url.includes("/documents/events/e1/projects/p1")) {
    return json({ updateTime: "2026-11-05T00:00:00Z", fields: fields({
      leaderId: "leader", memberEmails: ["leader@example.test", "mate@example.test"], registrationPending: pending,
      logo: storedPath ? { path: storedPath, storage: "supabase" } : null,
    }) });
  }
  if (url.includes("/documents/events/e1")) return json({ fields: fields({
    organizerEmails: ["org@example.test"], judgeEmails: ["judge@example.test"], resultsPublished: published,
    registrationOpen: open, submissions: { prototype: false, final: false },
  }) });
  if (url.includes("/documents/staff/")) return role ? json({ fields: fields({ role }) }) : json({}, 404);
  storageCalls++;
  if (url.endsWith("/bucket/code-submissions")) return json({ id: "code-submissions", name: "code-submissions", public: publicBucket, file_size_limit: 30 * 1024 * 1024 });
  if (url.endsWith("/object/code-submissions") && init?.method === "DELETE") {
    removed.push(...JSON.parse(init.body as string).prefixes);
    return deleteFails ? json({ message: "failure" }, 500) : json([]);
  }
  if (url.includes("/object/code-submissions/") && init?.method === "POST") {
    uploaded.push(url.split("/object/code-submissions/")[1]);
    return uploadFails ? json({ message: "failure" }, 400) : json({ Key: "logo" });
  }
  if (url.includes("/object/code-submissions/") && (!init?.method || init.method === "GET")) return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/webp" } });
  throw new Error(`Solicitud no simulada: ${url}`);
};

function request(method = "POST", file?: File, cleanup = false, token = "test-token") {
  const body = method === "POST" ? new FormData() : undefined;
  if (body) body.set("file", file ?? new File([new Uint8Array(png)], "logo.png", { type: "image/png" }));
  return new Request(`http://localhost/api/project-logo?eventId=e1&projectId=p1${cleanup ? "&cleanup=1" : ""}`, {
    method, headers: token ? { Authorization: `Bearer ${token}` } : {}, body,
  });
}
async function rejects(req: Request, status: number) {
  await assert.rejects(handleProjectLogo(req), error => error instanceof StorageRequestError && error.status === status);
}

describe("logo privado y opcional de la marca", { concurrency: false }, () => {
  before(async () => {
    png = await sharp({ create: { width: 700, height: 350, channels: 4, background: { r: 10, g: 200, b: 30, alpha: 0.5 } } }).png().toBuffer();
    mock.method(globalThis, "fetch", fakeFetch);
  });
  beforeEach(() => {
    Object.assign(process.env, env);
    email = "leader@example.test"; uid = "leader"; role = null;
    verified = true; pending = false; published = false; open = true; publicBucket = false;
    patchStatus = 200; patchLost = false; uploadFails = false; deleteFails = false;
    storageCalls = 0; storedPath = oldPath; uploaded = []; removed = []; savedLogo = undefined;
  });
  after(() => {
    mock.restoreAll();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  test("normaliza el logo a 512 px conservando proporción y transparencia", async () => {
    const bytes = await normalizeLogo(new File([new Uint8Array(png)], "logo.png", { type: "image/png" }));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 512); assert.equal(metadata.height, 256);
    assert.equal(metadata.format, "webp"); assert.equal(metadata.hasAlpha, true);
  });
  test("rechaza SVG, archivo vacío, más de 2 MB y rutas ajenas", () => {
    assert.throws(() => validateLogoFile({ size: 1, type: "image/svg+xml" }));
    assert.throws(() => validateLogoFile({ size: 0, type: "image/png" }));
    assert.throws(() => validateLogoFile({ size: MAX_LOGO_BYTES + 1, type: "image/png" }));
    assert.ok(isProjectLogoPath(oldPath, "e1", "p1"));
    assert.equal(isProjectLogoPath(oldPath, "e1", "p2"), false);
    assert.equal(isProjectLogoPath(oldPath.replace("logo/", "logo/../logo/"), "e1", "p1"), false);
  });
  test("sin sesión, sin verificar o suspendido no toca Storage", async () => {
    await rejects(request("GET", undefined, false, ""), 401);
    verified = false; await rejects(request(), 403);
    verified = true; role = "blocked"; await rejects(request(), 403);
    assert.equal(storageCalls, 0);
  });
  test("integrante, juez, organizador y admin no reemplazan ni quitan el logo", async () => {
    for (const name of ["mate", "judge", "org", "admin"]) {
      email = `${name}@example.test`; uid = name; role = name === "admin" ? "admin" : null;
      await rejects(request(), 403); await rejects(request("DELETE"), 403);
    }
    assert.equal(storageCalls, 0);
  });
  test("un ajeno no puede leer el logo", async () => {
    email = "outsider@example.test"; await rejects(request("GET"), 403);
    assert.equal(storageCalls, 0);
  });
  test("miembros y revisores consultan la imagen sin caché", async () => {
    for (const name of ["leader", "mate", "judge", "org", "admin"]) {
      email = `${name}@example.test`; uid = name; role = name === "admin" ? "admin" : null;
      const response = await handleProjectLogo(request("GET"));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/webp");
      assert.match(response.headers.get("cache-control")!, /no-store/);
    }
  });
  test("registro pendiente, resultados publicados y periodo cerrado bloquean cambios", async () => {
    pending = true; await rejects(request(), 403);
    pending = false; published = true; await rejects(request(), 403);
    published = false; open = false; await rejects(request("DELETE"), 403);
    assert.equal(storageCalls, 0);
  });
  test("el líder guarda una ruta privada y después elimina el logo previo", async () => {
    const response = await handleProjectLogo(request());
    const { logo } = await response.json();
    assert.ok(isProjectLogoPath(logo.path, "e1", "p1"));
    assert.deepEqual(uploaded, [logo.path]); assert.deepEqual(removed, [oldPath]);
    assert.equal(logo.storage, "supabase"); assert.ok(savedLogo);
  });
  test("el logo sigue siendo opcional y se puede agregar a un proyecto sin logo", async () => {
    storedPath = null;
    await rejects(request("GET"), 404);
    assert.equal((await handleProjectLogo(request())).status, 200);
    assert.deepEqual(removed, []);
  });
  test("una imagen corrupta no alcanza Storage", async () => {
    await rejects(request("POST", new File(["texto"], "fake.png", { type: "image/png" })), 400);
    assert.equal(storageCalls, 0);
  });
  test("una carga excesiva se rechaza aunque no declare Content-Length", async () => {
    await rejects(request("POST", new File([new Uint8Array(MAX_LOGO_BYTES + 100000)], "huge.png", { type: "image/png" })), 413);
    assert.equal(storageCalls, 0);
  });
  test("bucket público y emulador contra Supabase remoto se rechazan", async () => {
    publicBucket = true; await rejects(request(), 503);
    publicBucket = false; process.env.NEXT_PUBLIC_USE_EMULATORS = "true";
    await rejects(request(), 503);
    assert.equal(uploaded.length, 0);
  });
  test("si falla la subida conserva el logo anterior", async () => {
    uploadFails = true; await rejects(request(), 502);
    assert.equal(savedLogo, undefined); assert.deepEqual(removed, []);
  });
  test("si otra edición cambia el proyecto, limpia solo el archivo nuevo", async () => {
    patchStatus = 412; await rejects(request(), 409);
    assert.deepEqual(removed, uploaded); assert.ok(!removed.includes(oldPath));
  });
  test("si se pierde la respuesta de Firestore conserva ambas imágenes", async () => {
    patchLost = true;
    await assert.rejects(handleProjectLogo(request()), /respuesta se perdió/);
    assert.deepEqual(removed, []);
  });
  test("quitar borra la referencia y el objeto", async () => {
    assert.equal((await handleProjectLogo(request("DELETE"))).status, 200);
    assert.deepEqual(savedLogo, { nullValue: null }); assert.deepEqual(removed, [oldPath]);
  });
  test("un fallo de limpieza no reporta como fallido el reemplazo confirmado", async () => {
    deleteFails = true;
    assert.equal((await handleProjectLogo(request())).status, 200);
    assert.ok(savedLogo);
  });
  test("el organizador limpia el logo al retirar un proyecto, sin cambiar sus datos", async () => {
    email = "org@example.test"; uid = "org";
    assert.equal((await handleProjectLogo(request("DELETE", undefined, true))).status, 200);
    assert.equal(savedLogo, undefined); assert.deepEqual(removed, [oldPath]);
    published = true; await rejects(request("DELETE", undefined, true), 403);
  });
});
