import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

// Prueba de punta a punta del detector YA ACTIVADO (ver docs/detector.md o detector/ACTIVAR.md, paso 6).
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = process.env.OUT ?? "/tmp/detector-e2e";
const PASSWORD = "Prueba123!";
mkdirSync(OUT, { recursive: true });

const VP = {
  movil: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  },
  web: { viewport: { width: 1440, height: 900 } },
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const results = [];
let fails = 0;
const rec = (ok, msg) => {
  results.push(`${ok ? "✔" : "✖"} ${msg}`);
  if (!ok) fails++;
};
let n = 0;

async function login(email, vp = "movil") {
  const context = await browser.newContext({ ...VP[vp], locale: "es-MX" });
  await context.addInitScript(() => localStorage.setItem("theme", "light"));
  const page = await context.newPage();
  page.on("pageerror", (e) => rec(false, `[${email}] error JS: ${e.message.slice(0, 160)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|favicon|webchannel|permission-denied|Missing or insufficient/i.test(m.text()))
      rec(false, `[${email}] consola: ${m.text().slice(0, 160)}`);
  });
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL("**/panel", { timeout: 20000 });
  return { context, page, vp };
}

async function shot(s, name) {
  await s.page.waitForTimeout(500);
  const overflow = await s.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  rec(overflow <= 1, `${s.vp} · ${name}: ${overflow <= 1 ? "sin desborde" : `desborde ${overflow}px`}`);
  await s.page.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${s.vp}-${name}.png`, fullPage: true });
}

async function step(name, fn) {
  try {
    await fn();
    rec(true, name);
  } catch (e) {
    rec(false, `${name} → ${e.message.split("\n")[0]}`);
  }
}

const EV = `${BASE}/eventos/e1`;
const ECO = `${BASE}/eventos/e1/proyectos/p_eco`;
const modal = (p) => p.locator("dialog[open]");

/* 1. Organizador analiza */
const profe = await login("profe@tec.mx");
await step("organizador: pestaña Originalidad vacía no afirma «sin plagio»", async () => {
  await profe.page.goto(EV);
  await profe.page.getByText("Se activa con los primeros proyectos").or(profe.page.getByText("Sin casos", { exact: true })).first().waitFor();
  await profe.page.getByRole("tab", { name: /Originalidad/ }).click();
  await profe.page.getByRole("button", { name: "Analizar ahora" }).waitFor();
  await shot(profe, "originalidad-vacia");
});
await step("organizador: analizar abre 1 caso (copia) y no abre continuación ni plantilla declarada", async () => {
  await profe.page.getByRole("button", { name: "Analizar ahora" }).click();
  await profe.page.getByText("1 caso(s) nuevo(s)").waitFor({ timeout: 20000 });
  await profe.page.getByRole("button", { name: /EcoRiego/ }).waitFor();
  const bea = await profe.page.getByRole("button", { name: /Composta/ }).count();
  const carla = await profe.page.getByRole("button", { name: /Bitácora/ }).count();
  if (bea || carla) throw new Error(`casos de más: composta=${bea} bitácora=${carla}`);
  await profe.page.getByText("Mismo enlace").first().waitFor();
  await shot(profe, "originalidad-caso");
});
await step("organizador: el caso muestra quién fue primero, evidencia y frases resaltadas", async () => {
  await profe.page.getByRole("button", { name: /EcoRiego/ }).click();
  const m = modal(profe.page);
  await m.getByText("Quién apareció primero").waitFor();
  await m.getByText(/Apareció primero/).waitFor();
  const marks = await m.locator("mark").count();
  if (marks < 1) throw new Error("sin frases resaltadas");
  await shot(profe, "caso-detalle");
});

/* El organizador del evento actual no organizó 2024: no debería ver el nombre del otro proyecto */
await step("privacidad: el organizador de otro evento no ve el nombre del proyecto de 2024", async () => {
  const m = modal(profe.page);
  const visible = await m.getByText(/AquaSense/).count();
  if (visible) throw new Error("ve el nombre AquaSense");
});

await step("organizador: pide explicación al equipo", async () => {
  await modal(profe.page).getByRole("button", { name: "Pedir explicación al equipo" }).click();
  await profe.page.getByText("Se pidió al equipo su explicación.").waitFor();
});

/* 2. Equipo responde */
const ana = await login("ana@tec.mx");
await step("equipo: ve el aviso con sus frases resaltadas, sin el nombre del otro proyecto", async () => {
  await ana.page.goto(ECO);
  await ana.page.getByText("El organizador quiere tu explicación").waitFor({ timeout: 15000 });
  if (!(await ana.page.locator("mark").count())) throw new Error("sin resaltado");
  if (await ana.page.getByText(/AquaSense/).count()) throw new Error("ve el nombre del otro proyecto");
  if (await ana.page.getByRole("tab", { name: "Originalidad" }).count()) throw new Error("ve la pestaña de organizador");
  await shot(ana, "equipo-aviso");
});
await step("equipo: envía su explicación", async () => {
  await ana.page.getByLabel("Tu explicación").fill("Nos inspiramos en un proyecto que vimos en la expo de 2024, pero construimos nuestro propio circuito.");
  await ana.page.getByLabel("Enlace de prueba 1").fill("https://github.com/equipo-eco/ecoriego/commits");
  await ana.page.getByRole("button", { name: "Enviar explicación" }).click();
  await ana.page.getByText("Enviaste tu explicación").waitFor({ timeout: 15000 });
});

/* 3. Organizador propone, no puede confirmar solo */
await step("organizador: ve la respuesta y propone confirmar con penalización", async () => {
  const m = modal(profe.page);
  await m.getByText(/Respuesta del equipo ·/).waitFor({ timeout: 15000 });
  await m.getByLabel(/Motivo/).fill("Mismo repositorio que AquaSense 2024 y 85% de las frases idénticas. La explicación no justifica el reuso.");
  await m.getByLabel("Consecuencia si se confirma").selectOption("penalizacion");
  await m.getByRole("button", { name: "Proponer confirmación" }).click();
  await profe.page.getByText("Propuesta enviada a un admin.").waitFor();
  await m.getByText(/Esperando que un admin distinto/).waitFor();
  if (await m.getByRole("button", { name: "Confirmar", exact: true }).count()) throw new Error("el organizador puede confirmar solo");
  await shot(profe, "caso-propuesta");
});

/* 4. Admin distinto confirma */
const adm = await login("admin2@tec.mx");
await step("admin: confirma la propuesta", async () => {
  await adm.page.goto(EV);
  await adm.page.getByRole("tab", { name: /Originalidad/ }).click();
  await adm.page.getByRole("tab", { name: /Por confirmar/ }).click();
  await adm.page.getByRole("button", { name: /EcoRiego/ }).click();
  const m = modal(adm.page);
  await m.getByText(/AquaSense/).waitFor(); // el admin sí puede ver el proyecto de referencia
  await m.getByRole("button", { name: "Confirmar", exact: true }).click();
  await adm.page.getByText("Caso confirmado.").waitFor();
  await m.getByRole("button", { name: "Reabrir caso" }).waitFor();
  await shot(adm, "admin-confirmado");
});

/* 5. Juez ve la marca; equipo ve la decisión */
const juez = await login("juez@tec.mx");
await step("juez: ve la marca de caso confirmado y no la pestaña Originalidad", async () => {
  await juez.page.goto(ECO);
  await juez.page.getByText(/Caso de originalidad confirmado/).waitFor({ timeout: 15000 });
  if (await juez.page.getByRole("tab", { name: "Originalidad" }).count()) throw new Error("ve la pestaña");
  await shot(juez, "juez-marca");
});
await step("equipo: ve la decisión", async () => {
  await ana.page.reload();
  await ana.page.getByText("Resultado: Penalización en puntos").waitFor({ timeout: 15000 });
  await shot(ana, "equipo-decision");
});

/* 6. Registro nuevo con declaración + versiones */
const dani = await login("dani@tec.mx");
await step("alumno: el registro incluye la declaración de originalidad y guarda la primera versión", async () => {
  await dani.page.goto(EV);
  await dani.page.getByText("Declaración de originalidad").waitFor();
  await dani.page.getByLabel("Nombre del proyecto").fill("Semáforo Inteligente");
  await dani.page.getByLabel("Resumen").fill("Semáforo que cambia según el flujo de alumnos en los pasillos del tecnológico.");
  await dani.page.getByLabel("Problema que resuelve").fill("En los cambios de clase los pasillos se saturan y hay empujones en las escaleras principales.");
  await dani.page.getByLabel("Solución propuesta").fill("Cámaras de bajo costo cuentan personas y un semáforo indica qué escalera usar en cada momento.");
  await dani.page.getByLabel("Plantillas, librerías o código de terceros").fill("Usamos OpenCV https://github.com/opencv/opencv");
  await shot(dani, "registro-declaracion");
  await dani.page.getByRole("button", { name: "Registrar proyecto" }).click();
  await dani.page.waitForURL(/\/proyectos\//, { timeout: 20000 });
});
await step("organizador: ve las versiones guardadas del proyecto nuevo", async () => {
  const url = dani.page.url().replace(BASE, "");
  await profe.page.keyboard.press("Escape");
  await profe.page.goto(`${BASE}${url}`);
  await profe.page.getByRole("tab", { name: "Originalidad" }).click();
  await profe.page.getByText("Versiones guardadas").waitFor();
  await profe.page.getByText("Registro", { exact: true }).waitFor({ timeout: 15000 });
  await shot(profe, "versiones");
});
await step("organizador: sellar versión oficial", async () => {
  await profe.page.goto(EV);
  await profe.page.getByRole("tab", { name: /Originalidad/ }).click();
  await profe.page.getByRole("button", { name: "Sellar versión oficial" }).click();
  await profe.page.getByText(/Sellados 4 proyecto/).waitFor({ timeout: 30000 });
});

/* 7. Mismas pantallas en web */
const profeWeb = await login("profe@tec.mx", "web");
await step("web: panel de originalidad y caso", async () => {
  await profeWeb.page.goto(EV);
  await shot(profeWeb, "resumen");
  await profeWeb.page.getByRole("tab", { name: /Originalidad/ }).click();
  await profeWeb.page.getByRole("tab", { name: /Todos/ }).click();
  await profeWeb.page.getByRole("button", { name: /EcoRiego/ }).click();
  await modal(profeWeb.page).getByRole("heading", { name: "Historial" }).waitFor();
  await shot(profeWeb, "caso");
});
const anaWeb = await login("ana@tec.mx", "web");
await step("web: aviso del equipo", async () => {
  await anaWeb.page.goto(ECO);
  await anaWeb.page.getByText("Resultado: Penalización en puntos").waitFor({ timeout: 15000 });
  await shot(anaWeb, "equipo");
});

await browser.close();
console.log(results.join("\n"));
console.log(`\n${results.length - fails} correctas, ${fails} con problema`);
process.exit(fails ? 1 : 0);
