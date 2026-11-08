import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { AccessEmailError, accessEmailConfig, renderAccessEmail, sendBrevoAccessEmail } from "../lib/server/access-email";
import { feriaAccessLink } from "../lib/server/access-link";

const config = { apiKey: "key-for-unit-tests-only", from: "feria@example.com" };
const context = { role: "judge" as const, eventName: "Feria de Ingeniería 2026" };
const link = "https://code-94fbe.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=fake&lang=es";

test("Brevo se activa solo con proveedor, remitente y secreto completos; emuladores conservan Firebase", () => {
  assert.equal(accessEmailConfig({}), null);
  assert.equal(accessEmailConfig({ FERIA_MAIL_PROVIDER: "firebase" }), null);
  const env = { FERIA_MAIL_PROVIDER: "brevo", FERIA_MAIL_FROM: config.from, FERIA_BREVO_API_KEY: config.apiKey };
  assert.deepEqual(accessEmailConfig(env), config);
  for (const isolated of [{ NEXT_PUBLIC_USE_EMULATORS: "true" }, { FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" },
    { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085" }]) assert.equal(accessEmailConfig({ ...env, ...isolated }), null);
  for (const invalid of [{ FERIA_BREVO_API_KEY: "" }, { FERIA_MAIL_FROM: "bad\r\nBcc: other@example.com" },
    { FERIA_MAIL_PROVIDER: "unknown" }, { FERIA_BREVO_API_KEY: "bad\r\nkey" }]) {
    assert.throws(() => accessEmailConfig({ ...env, ...invalid }), AccessEmailError);
  }
});

test("el mensaje usa el logo y la acción segura, escapa contenido y ofrece texto plano", async () => {
  const message = await renderAccessEmail("juez@example.com", context, link);
  assert.equal(message.subject, "Tu acceso a Feria 2026");
  assert.match(message.html, /logo\.png/);
  assert.match(message.html, /Configurar mi acceso/);
  assert.match(message.html, /Feria de Ingeniería 2026/);
  assert.match(message.html, /oobCode=fake&amp;lang=es/);
  assert.ok(message.text.includes(link));
  assert.doesNotMatch(message.html, /\{\{[A-Z_]+\}\}/);
  const escaped = await renderAccessEmail("juez@example.com", { ...context, eventName: '</strong><script>alert("x")</script>' }, link);
  assert.doesNotMatch(escaped.html, /<script>/);
  assert.match(escaped.html, /&lt;script&gt;/);
  const staff = await renderAccessEmail("admin@example.com", { role: "admin", eventName: null }, link);
  assert.match(staff.text, /administrador en la plataforma Feria 2026/);
  await assert.rejects(renderAccessEmail("juez@example.com", context, "javascript:alert(1)"), AccessEmailError);
});

test("envía a un único destinatario sin listas de marketing y devuelve solo confirmación del proveedor", async () => {
  const action = feriaAccessLink(link);
  assert.equal(action, "https://feria2026.web.app/acceso#oobCode=fake");
  let calls = 0;
  const mocked = mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    calls++;
    assert.equal(String(url), "https://api.brevo.com/v3/smtp/email");
    assert.equal(new Headers(init?.headers).get("api-key"), config.apiKey);
    const body = JSON.parse(init!.body as string);
    assert.deepEqual(body.sender, { name: "Feria 2026", email: config.from });
    assert.deepEqual(body.to, [{ email: "juez@example.com", contactPixelTrackingConsent: false }]);
    assert.ok(body.textContent.includes(action));
    assert.ok(body.htmlContent.includes(`href="${action}"`));
    assert.equal(body.subject, "Tu acceso a Feria 2026");
    assert.equal(body.bcc, undefined); assert.equal(body.cc, undefined); assert.equal(body.listIds, undefined);
    assert.ok(!JSON.stringify(body).includes(config.apiKey));
    return Response.json({ messageId: "provider-message-id" }, { status: 201 });
  });
  try {
    assert.deepEqual(await sendBrevoAccessEmail(config, "juez@example.com", context, action),
      { provider: "brevo", messageId: "provider-message-id" });
    assert.equal(calls, 1);
  } finally { mocked.mock.restore(); }
});

test("rechazos, cuotas y respuestas perdidas no se reenvían ni filtran secretos", async () => {
  for (const response of [new Response(config.apiKey, { status: 400 }), new Response("quota", { status: 429 }), Response.json({}, { status: 201 }), null]) {
    let calls = 0;
    const mocked = mock.method(globalThis, "fetch", async () => {
      calls++;
      if (!response) throw new Error("timeout "+config.apiKey);
      return response;
    });
    try {
      await assert.rejects(sendBrevoAccessEmail(config, "juez@example.com", context, link), error => {
        assert.ok(error instanceof AccessEmailError);
        assert.ok(!error.message.includes(config.apiKey));
        if (response?.status === 429) assert.equal(error.status, 429);
        return true;
      });
      assert.equal(calls, 1);
    } finally { mocked.mock.restore(); }
  }
});
