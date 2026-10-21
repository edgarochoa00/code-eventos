/**
 * Pruebas de la lógica del detector (sin Firebase).
 * Uso: npm run detector:test:logic
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { caseIdFor, decideAlerts, eventExclusions, findCandidates, shinglesToLoad, toComparable } from "@/lib/detector/detect";
import { compareEvidence } from "@/lib/detector/evidence";
import { highlight } from "@/lib/detector/highlight";
import { buildSignals } from "@/lib/detector/signals";
import type { DetectorProject, IndexEntry, LiveProject } from "@/lib/detector/types";

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 9, 1);

// Textos inventados para las pruebas (no corresponden a proyectos reales)
const ORIGINAL = {
  summary: "Medidor de ruido para salones de clase que avisa con luces cuando el volumen es demasiado alto.",
  problem:
    "En los salones grandes el ruido no deja escuchar al maestro y nadie se da cuenta de cuándo el volumen pasa de lo tolerable durante las actividades en equipo.",
  solution:
    "Un micrófono conectado a una placa Arduino mide el nivel de ruido cada segundo, enciende una tira de luces de colores cuando pasa el límite y guarda un registro que el maestro consulta desde el celular.",
};

function project(id: string, over: Partial<DetectorProject> & { links?: string[]; files?: string[] } = {}): DetectorProject {
  const { links = [], files = [], ...rest } = over;
  return {
    id,
    eventId: "e2026",
    title: `Proyecto ${id}`,
    summary: "Aplicación para apartar las canchas deportivas del tecnológico con recordatorios.",
    problem: "Los equipos llegan a las canchas y las encuentran ocupadas porque no hay forma de saber quién las apartó antes.",
    solution: "Una app web con calendario de canchas, apartados por hora y recordatorios enviados por correo electrónico.",
    technologies: ["React"],
    category: "Software",
    leaderId: id,
    leaderEmail: `${id}@tec.mx`,
    members: [{ name: id, email: `${id}@tec.mx` }],
    memberEmails: [`${id}@tec.mx`],
    prototype: links.length || files.length
      ? {
          description: "Prototipo funcional.",
          links: links.map((url) => ({ label: "Repositorio", url })),
          files: files.map((sha256, i) => ({ name: `f${i}.zip`, size: 1, type: "application/zip", sha256 })),
          submittedAt: null,
          submittedBy: "",
        }
      : null,
    final: null,
    createdAt: null,
    updatedAt: null,
    ...rest,
  } as DetectorProject;
}

async function live(p: DetectorProject, firstSeenAt: number): Promise<LiveProject> {
  return { project: p, signals: await buildSignals(p), firstSeenAt };
}

async function indexEntry(p: DetectorProject, firstSeenAt: number): Promise<{ entry: IndexEntry; shingles: number[] }> {
  const s = await buildSignals(p);
  const { shingles, contentHash: _c, ...rest } = s;
  void _c;
  return { entry: { ...rest, projectId: p.id, eventId: p.eventId, year: new Date(firstSeenAt).getFullYear(), firstSeenAt }, shingles };
}

async function run(liveProjects: LiveProject[], historical: { entry: IndexEntry; shingles: number[] }[], eventTexts: string[] = []) {
  const excluded = eventExclusions(eventTexts, liveProjects);
  const pairs = findCandidates(liveProjects, historical.map((h) => h.entry), "e2026");
  const toLoad = shinglesToLoad(pairs);
  const map = new Map(historical.filter((h) => toLoad.includes(h.entry.projectId)).map((h) => [h.entry.projectId, h.shingles]));
  return decideAlerts(pairs, map, excluded);
}

describe("evidencia por tipo", () => {
  test("copia renombrada de un proyecto de hace 2 años → texto, abre caso", async () => {
    const old = await indexEntry(project("old", { eventId: "e2024", ...ORIGINAL }), BASE - 730 * DAY);
    const copy = await live(project("copy", { title: "Proyecto Beta", ...ORIGINAL }), BASE);
    const alerts = await run([copy], [old]);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].evidence.level, "texto");
    assert.ok(alerts[0].evidence.phrases.containment > 0.8);
    assert.equal(alerts[0].projectId, "copy");
  });

  test("proyectos distintos → sin caso", async () => {
    const old = await indexEntry(project("old", { eventId: "e2024", ...ORIGINAL }), BASE - 365 * DAY);
    const other = await live(project("otro"), BASE);
    assert.equal((await run([other], [old])).length, 0);
  });

  test("mismo tema con otras palabras → tema, sin caso", async () => {
    const old = await indexEntry(project("old", { eventId: "e2024", ...ORIGINAL }), BASE - 365 * DAY);
    const para = await live(
      project("para", {
        summary: "Sensor que detecta cuando hay demasiado ruido en el aula y lo indica con colores.",
        problem: "Cuando trabajan en equipo los alumnos suben la voz, el profesor deja de oírse y nadie nota que el ruido ya es excesivo.",
        solution: "Una placa Arduino con micrófono revisa el volumen todo el tiempo, prende luces si se rebasa el máximo y manda los datos a una app.",
      }),
      BASE,
    );
    const ev = compareEvidence(toComparable(para), old.entry, para.signals.shingles, old.shingles, new Set());
    assert.equal(ev.alert, false);
    assert.notEqual(ev.level, "texto");
  });

  test("mismo repositorio (con .git y mayúsculas) → enlace", async () => {
    const old = await indexEntry(project("old", { eventId: "e2024", ...ORIGINAL, links: ["https://github.com/Equipo/Proyecto-Alfa"] }), BASE - 365 * DAY);
    const b = await live(project("b", { links: ["github.com/equipo/proyecto-alfa.git"] }), BASE);
    const alerts = await run([b], [old]);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].evidence.level, "enlace");
  });

  test("enlace declarado como plantilla de terceros → no abre caso", async () => {
    const old = await indexEntry(project("old", { eventId: "e2024", ...ORIGINAL, links: ["https://github.com/plantillas/expo-starter"] }), BASE - 365 * DAY);
    const b = await live(
      project("b", {
        links: ["https://github.com/plantillas/expo-starter"],
        declaration: { continues: "", sources: "Usamos la plantilla https://github.com/plantillas/expo-starter" },
      }),
      BASE,
    );
    assert.equal((await run([b], [old])).length, 0);
  });

  test("mismo archivo → archivo, aunque el texto sea distinto", async () => {
    const old = await indexEntry(project("old", { eventId: "e2024", ...ORIGINAL, files: ["a".repeat(64)] }), BASE - 365 * DAY);
    const b = await live(project("b", { files: ["a".repeat(64)], summary: "Otra cosa totalmente diferente sobre robots." }), BASE);
    const alerts = await run([b], [old]);
    assert.equal(alerts[0]?.evidence.level, "archivo");
  });

  test("mismo equipo continuando su proyecto → no abre caso, marca continuación", async () => {
    const old = await indexEntry(
      project("old", { eventId: "e2024", ...ORIGINAL, memberEmails: ["ana@tec.mx", "luis@tec.mx"] }),
      BASE - 365 * DAY,
    );
    const cont = await live(project("cont", { ...ORIGINAL, memberEmails: ["Ana@tec.mx", "nuevo@tec.mx"] }), BASE);
    assert.equal((await run([cont], [old])).length, 0);
    const ev = compareEvidence(toComparable(cont), old.entry, cont.signals.shingles, old.shingles, new Set());
    assert.equal(ev.continuation, true);
    assert.equal(ev.level, "texto");
    assert.equal(ev.alert, false);
  });
});

describe("filtros y prioridad", () => {
  test("el texto de las bases del evento no cuenta", async () => {
    const bases =
      "Los proyectos deben resolver un problema real de la comunidad escolar usando tecnología accesible y presentar un prototipo funcional al jurado.";
    const a = await live(project("a", { problem: bases, solution: "Robot que clasifica basura reciclable con visión por computadora." }), BASE);
    const b = await live(project("b", { problem: bases, solution: "Bicicleta estática que genera electricidad para cargar celulares." }), BASE + DAY);
    assert.equal((await run([a, b], [], [bases])).length, 0);
    // Sin excluir las bases sí coincidirían
    const withoutFilter = compareEvidence(toComparable(b), toComparable(a), b.signals.shingles, a.signals.shingles, new Set());
    assert.ok(withoutFilter.phrases.shared >= 8, "sin filtro las bases sí cuentan como frases en común");
  });

  test("frases que usan muchos equipos del mismo evento no cuentan", async () => {
    const common = "Nuestro proyecto busca mejorar la calidad de vida de los estudiantes del instituto tecnológico de Culiacán mediante innovación.";
    const make = (id: string, extra: string, day: number) => live(project(id, { summary: common, problem: extra, solution: extra }), BASE + day * DAY);
    const all = await Promise.all([
      make("p1", "Robot de reciclaje con visión.", 1),
      make("p2", "Invernadero escolar con control de temperatura.", 2),
      make("p3", "App para compartir apuntes entre carreras.", 3),
      make("p4", "Estación meteorológica con paneles solares.", 4),
    ]);
    assert.equal((await run(all, [])).length, 0);
  });

  test("dentro del mismo evento el caso se abre en el proyecto posterior", async () => {
    const first = await live(project("first", ORIGINAL), BASE);
    const second = await live(project("second", ORIGINAL), BASE + DAY);
    const alerts = await run([first, second], []);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].projectId, "second");
    assert.equal(alerts[0].other.projectId, "first");
    assert.equal(caseIdFor("second", "first"), "second__first");
  });

  test("un proyecto antiguo nunca carga con el caso de uno nuevo de otro evento", async () => {
    const newer = await indexEntry(project("newer", { eventId: "e2027", ...ORIGINAL }), BASE + 365 * DAY);
    const older = await live(project("older", ORIGINAL), BASE);
    assert.equal((await run([older], [newer])).length, 0);
  });
});

describe("resaltado", () => {
  test("resalta en el texto propio la frase copiada", async () => {
    const old = await indexEntry(project("old", { eventId: "e2024", ...ORIGINAL }), BASE - 365 * DAY);
    const text = `Nuestra idea nueva. ${ORIGINAL.solution} Además agregamos un panel solar.`;
    const b = await live(project("b", { solution: text }), BASE);
    const ev = compareEvidence(toComparable(b), old.entry, b.signals.shingles, old.shingles, new Set());
    const segments = highlight(text, new Set(ev.matched));
    const marked = segments.filter((s) => s.match).map((s) => s.text).join(" ");
    assert.ok(marked.includes("tira de luces"), marked);
    assert.ok(!marked.includes("panel solar"), marked);
    assert.equal(segments.map((s) => s.text).join(""), text);
  });
});
