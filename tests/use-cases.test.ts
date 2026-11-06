// Casos de uso integrales por rol, lógica de negocio, evaluación y originalidad (sin conectar a la nube).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { categoryCriteriaError, criteriaError, deliverySettingsError, evaluationScoresError, getCategoryCriteria, getPhaseDetails, getPhaseLabel } from "../lib/event-config";
import {
  analysisState,
  buildFingerprint,
  compareFingerprints,
  findMatches,
  levelFor,
  normalizeText,
  normalizeUrl,
  sha256Text,
  tokenize,
} from "../lib/similarity";
import { computeStandings, resultRubricColumns } from "../lib/results";
import { MAX_FILE_BYTES, MAX_SUBMISSION_FILES, validateSubmissionFiles } from "../lib/submission-files";
import { DEFAULT_ORIGINALITY, SUPERADMIN_EMAIL, type Criterion, type EvaluationDoc, type EventDoc, type FileItem, type ProjectDoc } from "../lib/types";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CRITERIA,
  effectiveEvaluationTotal,
  eventCategories,
  formatBytes,
  hasJudgeAssignment,
  initials,
  isEmail,
  isProjectAssignedToJudge,
  judgesSeeOriginality,
  normalizeEmail,
  originalitySettings,
  parseEmails,
  randomCode,
  rolesInEvent,
  safeUrl,
  teamsSeeOriginality,
  todayISO,
  weightedTotal,
} from "../lib/utils";

const baseEvent: EventDoc = {
  id: "ev-test",
  name: "Expo Ciencias 2026",
  description: "Evento de prueba de casos de uso",
  institution: "Instituto Tecnológico",
  code: "EXPO26",
  ownerId: "uid-org",
  ownerEmail: "organizador@tec.mx",
  organizerEmails: ["organizador@tec.mx", "coorganizador@tec.mx"],
  judgeEmails: ["juez1@tec.mx", "juez2@tec.mx"],
  phases: { prototype: true, final: true },
  submissions: { prototype: true, final: false },
  registrationOpen: true,
  judgingOpen: false,
  maxTeamSize: 4,
  criteria: DEFAULT_CRITERIA,
  categories: ["Software", "Hardware / IoT", "Salud"],
  startDate: "2026-11-01",
  endDate: "2026-11-15",
  resultsPublished: false,
  results: null,
  originality: DEFAULT_ORIGINALITY,
  createdAt: null,
};

const makeProject = (overrides: Partial<ProjectDoc> = {}): ProjectDoc => ({
  id: "proj-1",
  eventId: "ev-test",
  title: "Monitor Inteligente de Calidad del Aire Escolar",
  summary: "Sistema IoT con sensores de CO2 y partículas PM2.5 para salones de clases con alertas en tiempo real.",
  problem:
    "En las aulas cerradas con treinta estudiantes la concentración de dióxido de carbono supera los niveles recomendados provocando somnolencia y baja retención académica sin que el docente perciba el deterioro ambiental.",
  solution:
    "Un nodo basado en microcontrolador ESP32 lee sensores NDIR cada diez segundos, activa ventilación automática mediante relevadores y transmite métricas históricas a un panel web progresivo para mantenimiento escolar.",
  technologies: ["ESP32", "Next.js", "Sensores NDIR"],
  category: "Hardware / IoT",
  leaderId: "uid-lider",
  leaderEmail: "lider@tec.mx",
  members: [
    { name: "Alumno Líder", email: "lider@tec.mx" },
    { name: "Alumno Integrante", email: "integrante@tec.mx" },
  ],
  memberEmails: ["lider@tec.mx", "integrante@tec.mx"],
  prototype: null,
  final: null,
  createdAt: null,
  updatedAt: null,
  ...overrides,
});

describe("Configuración de cada evento por su organizador", () => {
  const carteles: EventDoc = {
    ...baseEvent,
    name: "Carteles",
    phases: { prototype: true, final: false },
    phaseDetails: { prototype: { name: "Cartel", description: "Presenta un cartel con los resultados de tu investigación." } },
    criteria: [{ id: "claridad", name: "Claridad visual", description: "Lectura y organización del cartel", weight: 100 }],
  };
  const prototipos: EventDoc = {
    ...baseEvent,
    name: "Prototipos",
    phases: { prototype: true, final: false },
    phaseDetails: { prototype: { name: "Modelo funcional", description: "Explica y demuestra su funcionamiento." } },
    criteria: [{ id: "demostracion", name: "Demostración", description: "Funcionamiento en vivo", weight: 100 }],
  };

  test("Carteles y Prototipos tienen entregas, instrucciones y criterios independientes", () => {
    assert.equal(getPhaseLabel(carteles, "prototype"), "Cartel");
    assert.equal(getPhaseLabel(prototipos, "prototype"), "Modelo funcional");
    assert.match(getPhaseDetails(carteles, "prototype").description, /investigación/);
    assert.equal(deliverySettingsError(carteles), null);
    assert.equal(deliverySettingsError(prototipos), null);
    assert.equal(criteriaError(carteles.criteria), null);
    assert.equal(weightedTotal(carteles.criteria, { claridad: 8 }), 80);
    assert.equal(weightedTotal(prototipos.criteria, { demostracion: 9.5 }), 95);
    assert.equal(carteles.criteria[0].name, "Claridad visual");
  });

  test("las entregas históricas conservan sus etiquetas y sus instrucciones", () => {
    assert.equal(getPhaseLabel(baseEvent, "prototype"), "Prototipo");
    assert.equal(getPhaseLabel(baseEvent, "final"), "Producto final");
    assert.match(getPhaseDetails(baseEvent, "prototype").description, /Qué funciona ya/);
    assert.equal(baseEvent.phaseDetails, undefined);
    assert.equal(getPhaseLabel(carteles, "final"), "Producto final");
    assert.deepEqual(getPhaseDetails({ phases: { prototype: true, final: false } }, "prototype"), {
      name: "Entrega",
      description: "",
    });
  });

  test("una entrega personalizada sin instrucciones no hereda las de prototipo", () => {
    assert.deepEqual(getPhaseDetails({ phaseDetails: { prototype: { name: "Cartel", description: "" } } }, "prototype"), {
      name: "Cartel", description: "",
    });
  });

  test("permite una sola entrega en cualquiera de los espacios y una segunda opcional", () => {
    assert.equal(deliverySettingsError({
      phases: { prototype: false, final: true },
      phaseDetails: { final: { name: "Exposición", description: "" } },
    }), null);
    assert.equal(deliverySettingsError({
      phases: { prototype: true, final: true },
      phaseDetails: {
        prototype: { name: "Cartel", description: "" },
        final: { name: "Defensa oral", description: "" },
      },
    }), null);
  });

  test("rechaza entregas sin nombre, duplicadas, demasiado largas o todas desactivadas", () => {
    assert.ok(deliverySettingsError({ phases: { prototype: false, final: false } }));
    assert.ok(deliverySettingsError({ phases: carteles.phases }));
    assert.ok(deliverySettingsError({ ...carteles, phaseDetails: { prototype: { name: "  ", description: "" } } }));
    assert.ok(deliverySettingsError({
      phases: { prototype: true, final: true },
      phaseDetails: {
        prototype: { name: "Cartel", description: "" },
        final: { name: " CARTEL ", description: "" },
      },
    }));
    assert.ok(deliverySettingsError({ ...carteles, phaseDetails: { prototype: { name: "a".repeat(81), description: "" } } }));
    assert.ok(deliverySettingsError({ ...carteles, phaseDetails: { prototype: { name: "Cartel", description: "a".repeat(2001) } } }));
  });

  test("la rúbrica necesita criterios propios con nombres y pesos válidos", () => {
    assert.ok(criteriaError([]));
    assert.ok(criteriaError([{ id: "a", name: "  ", description: "", weight: 100 }]));
    for (const weight of [0, -1, 101, NaN, Infinity]) {
      assert.ok(criteriaError([{ id: "a", name: "Diseño", description: "", weight }]));
    }
    assert.ok(criteriaError([...carteles.criteria, ...carteles.criteria]));
    assert.ok(criteriaError(Array.from({ length: 21 }, (_, i) => ({ id: `c${i}`, name: `Criterio ${i}`, description: "", weight: 1 }))));
    assert.equal(criteriaError([
      { id: "a", name: "Diseño", description: "", weight: 3 },
      { id: "b", name: "Contenido", description: "", weight: 7 },
      { id: "c", name: "Opcional", description: "", weight: 0 },
    ]), null);
  });
});

describe("Casos de uso · Roles y permisos en eventos (rolesInEvent)", () => {
  test("CU-01: Superadmin y Admin global actúan como organizadores en cualquier evento", () => {
    assert.deepEqual(rolesInEvent(baseEvent, SUPERADMIN_EMAIL, true), ["organizer"]);
    assert.deepEqual(rolesInEvent(baseEvent, "admin.externo@tec.mx", true), ["organizer"]);
  });

  test("CU-02: Organizador titular y coorganizador obtienen rol organizer", () => {
    assert.deepEqual(rolesInEvent(baseEvent, "ORGANIZADOR@tec.mx", false), ["organizer"]);
    assert.deepEqual(rolesInEvent(baseEvent, "  coorganizador@tec.mx ", false), ["organizer"]);
  });

  test("CU-03: Juez asignado obtiene rol judge; la administración tiene prioridad ante roles antiguos mezclados", () => {
    assert.deepEqual(rolesInEvent(baseEvent, "juez1@tec.mx", false), ["judge"]);
    const dualEvent: EventDoc = {
      ...baseEvent,
      judgeEmails: ["organizador@tec.mx", "juez1@tec.mx"],
    };
    assert.deepEqual(rolesInEvent(dualEvent, "organizador@tec.mx", false), ["organizer"]);
    assert.deepEqual(rolesInEvent(baseEvent, "juez1@tec.mx", true), ["organizer"]);
  });

  test("CU-04: Alumnos líderes, integrantes y usuarios nuevos obtienen rol student por defecto", () => {
    assert.deepEqual(rolesInEvent(baseEvent, "lider@tec.mx", false), ["student"]);
    assert.deepEqual(rolesInEvent(baseEvent, "integrante@tec.mx", false), ["student"]);
    assert.deepEqual(rolesInEvent(baseEvent, "nuevo@tec.mx", false), ["student"]);
    assert.deepEqual(rolesInEvent(baseEvent, null, false), ["student"]);
  });
});

describe("Casos de uso · Asignación de jueces por categoría y proyecto", () => {
  const projHardware = makeProject({ id: "p-hw", category: "Hardware / IoT" });
  const projSoftware = makeProject({ id: "p-sw", category: "Software" });
  const projSalud = makeProject({ id: "p-med", category: "Salud" });

  test("CU-05: Juez sin asignación específica puede evaluar todos los proyectos del evento", () => {
    assert.equal(hasJudgeAssignment(baseEvent, "juez1@tec.mx"), false);
    assert.equal(isProjectAssignedToJudge(baseEvent, projHardware, "juez1@tec.mx"), true);
    assert.equal(isProjectAssignedToJudge(baseEvent, projSoftware, "juez1@tec.mx"), true);
    assert.equal(isProjectAssignedToJudge(baseEvent, projSalud, "juez1@tec.mx"), true);
  });

  test("CU-06: Juez asignado por categoría o proyecto específico solo evalúa los que le corresponden", () => {
    const assignedEvent: EventDoc = {
      ...baseEvent,
      judgeAssignments: {
        "juez1@tec.mx": { categories: ["Hardware / IoT"], projectIds: ["p-med"] },
        "juez2@tec.mx": { categories: ["Software"] },
      },
    };
    assert.equal(hasJudgeAssignment(assignedEvent, "JUEZ1@tec.mx"), true);
    assert.equal(isProjectAssignedToJudge(assignedEvent, projHardware, "juez1@tec.mx"), true);
    assert.equal(isProjectAssignedToJudge(assignedEvent, projSalud, "juez1@tec.mx"), true);
    assert.equal(isProjectAssignedToJudge(assignedEvent, projSoftware, "juez1@tec.mx"), false);

    assert.equal(isProjectAssignedToJudge(assignedEvent, projSoftware, "juez2@tec.mx"), true);
    assert.equal(isProjectAssignedToJudge(assignedEvent, projHardware, "juez2@tec.mx"), false);
  });

  test("administrar, pertenecer al proyecto o no ser juez impide calificar aun con asignación explícita", () => {
    assert.equal(isProjectAssignedToJudge(baseEvent, projSoftware, "juez1@tec.mx", true), false);
    assert.equal(isProjectAssignedToJudge(baseEvent, projSoftware, "nuevo@tec.mx"), false);
    assert.equal(isProjectAssignedToJudge(baseEvent, makeProject({ memberEmails: ["juez1@tec.mx"] }), "juez1@tec.mx"), false);
    const oldEvent = { ...baseEvent, judgeEmails: [...baseEvent.judgeEmails, "organizador@tec.mx"] };
    assert.equal(isProjectAssignedToJudge(oldEvent, projHardware, "organizador@tec.mx"), false);
  });
});

describe("Casos de uso · Rúbrica, calificación ponderada y recálculo de resultados", () => {
  test("CU-07: Cálculo ponderado exacto sobre escala 0–10 normalizado a 0–100", () => {
    const perfectScores = { innovacion: 10, tecnica: 10, impacto: 10, funcionalidad: 10, presentacion: 10 };
    assert.equal(weightedTotal(DEFAULT_CRITERIA, perfectScores), 100);

    const mixedScores = { innovacion: 8, tecnica: 9, impacto: 7, funcionalidad: 10, presentacion: 6 };
    // (8*25 + 9*25 + 7*20 + 10*15 + 6*15) / 100 = (200 + 225 + 140 + 150 + 90) / 10 = 80.5
    assert.equal(weightedTotal(DEFAULT_CRITERIA, mixedScores), 80.5);
  });

  test("CU-08: Recálculo dinámico cuando el organizador ajusta pesos de la rúbrica", () => {
    const customCriteria: Criterion[] = [
      { id: "c1", name: "Técnica", description: "", weight: 60 },
      { id: "c2", name: "Pitch", description: "", weight: 40 },
    ];
    const evalDoc: Pick<EvaluationDoc, "scores" | "total"> = {
      scores: { c1: 10, c2: 5 },
      total: 50, // total antiguo antes de ajustar pesos
    };
    // Nuevo total esperado: (10*60 + 5*40)/10 = 80
    assert.equal(effectiveEvaluationTotal(customCriteria, evalDoc), 80);

    // Si la rúbrica cambió por completo de IDs y no coincide ninguno, conserva el total guardado
    const unrelatedCriteria: Criterion[] = [{ id: "nuevo", name: "Nuevo", description: "", weight: 100 }];
    assert.equal(effectiveEvaluationTotal(unrelatedCriteria, evalDoc), 50);
  });
});

describe("Casos de uso · Visibilidad del análisis de originalidad para jueces y equipos", () => {
  test("CU-09: Visibilidad para jueces según configuración ('always' vs 'judging')", () => {
    assert.equal(judgesSeeOriginality(baseEvent), true); // default is 'always'

    const onlyDuringJudging: EventDoc = {
      ...baseEvent,
      judgingOpen: false,
      resultsPublished: false,
      originality: { judges: "judging", teams: "hidden", teamsFrom: "" },
    };
    assert.equal(judgesSeeOriginality(onlyDuringJudging), false);
    assert.equal(judgesSeeOriginality({ ...onlyDuringJudging, judgingOpen: true }), true);
    assert.equal(judgesSeeOriginality({ ...onlyDuringJudging, resultsPublished: true }), true);
  });

  test("CU-10: Visibilidad para equipos ('hidden', 'results', 'date')", () => {
    assert.equal(teamsSeeOriginality(baseEvent), false);

    const onResults: EventDoc = {
      ...baseEvent,
      resultsPublished: false,
      originality: { judges: "always", teams: "results", teamsFrom: "" },
    };
    assert.equal(teamsSeeOriginality(onResults), false);
    assert.equal(teamsSeeOriginality({ ...onResults, resultsPublished: true }), true);

    const today = todayISO();
    const onDatePast: EventDoc = {
      ...baseEvent,
      originality: { judges: "always", teams: "date", teamsFrom: "2020-01-01" },
    };
    const onDateFuture: EventDoc = {
      ...baseEvent,
      originality: { judges: "always", teams: "date", teamsFrom: "2099-12-31" },
    };
    assert.equal(teamsSeeOriginality(onDatePast), true);
    assert.equal(teamsSeeOriginality({ ...baseEvent, originality: { judges: "always", teams: "date", teamsFrom: today } }), true);
    assert.equal(teamsSeeOriginality(onDateFuture), false);
    assert.deepEqual(originalitySettings({ ...baseEvent, originality: undefined }), DEFAULT_ORIGINALITY);
  });
});

describe("Casos de uso · Detección de similitud y anti-plagio histórico", () => {
  test("CU-11: Detecta copia textual alta e idéntica entre eventos de distintos años", async () => {
    const historical = makeProject({ id: "hist-2024", eventId: "ev-2024", title: "Monitor de CO2 Escolar 2024" });
    const currentCopy = makeProject({ id: "curr-2026", eventId: "ev-2026", title: "Alerta Ambiental de CO2 en Aulas" });

    const fpHist = { ...(await buildFingerprint(historical, "Expo 2024")), updatedAt: null };
    const fpCopy = { ...(await buildFingerprint(currentCopy, "Expo 2026")), updatedAt: null };

    assert.equal(analysisState(fpHist), "ready");
    const match = compareFingerprints(fpCopy, fpHist);
    assert.equal(match.level, "alto");
    assert.ok(match.score >= 0.85, `Se esperaba similitud alta, se obtuvo ${match.score}`);
  });

  test("CU-12: Detecta archivo entregado con mismo hash SHA-256 aunque el texto sea completamente distinto", async () => {
    const sharedHash = await sha256Text("contenido-binario-del-prototipo-pdf");
    const fileA: FileItem = {
      name: "memoria-2024.pdf",
      size: 4096,
      type: "application/pdf",
      sha256: sharedHash,
      storage: "supabase",
      path: "events/ev-2024/projects/p-a/prototype/1_memoria-2024.pdf",
    };
    const fileB: FileItem = {
      name: "entrega-renombrada.pdf",
      size: 4096,
      type: "application/pdf",
      sha256: sharedHash,
      storage: "supabase",
      path: "events/ev-2026/projects/p-b/prototype/2_entrega-renombrada.pdf",
    };

    const projA = makeProject({
      id: "p-a",
      prototype: { description: "Prototipo A", links: [], files: [fileA], submittedAt: null, submittedBy: "a@tec.mx" },
    });
    const projB = makeProject({
      id: "p-b",
      title: "Sistema de Gestión Hospitalaria con Inteligencia Artificial",
      summary: "Aplicación médica para triaje de urgencias y control de turnos clínicos.",
      problem: "Los pacientes esperan horas en urgencias por falta de clasificación automatizada de síntomas.",
      solution: "Un modelo predictivo prioriza pacientes críticos y asigna consultorios disponibles al instante.",
      technologies: ["Python", "FastAPI", "React"],
      prototype: { description: "Prototipo B", links: [], files: [fileB], submittedAt: null, submittedBy: "b@tec.mx" },
    });

    const fpA = { ...(await buildFingerprint(projA, "Expo 2024")), updatedAt: null };
    const fpB = { ...(await buildFingerprint(projB, "Expo 2026")), updatedAt: null };

    const matches = findMatches(fpB, [fpA, fpB]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].score, 1);
    assert.equal(matches[0].sharedFiles, 1);
    assert.equal(matches[0].level, "alto");
  });

  test("CU-13: Proyectos originales con temáticas distintas no disparan falsos positivos", async () => {
    const projIoT = makeProject({ id: "p-iot" });
    const projFinanzas = makeProject({
      id: "p-fin",
      title: "Simulador Gamificado de Educación Financiera para Bachillerato",
      summary: "Juego móvil interactivo para aprender ahorro, inversión en renta fija y presupuesto personal.",
      problem:
        "Los jóvenes egresan de preparatoria desconociendo conceptos básicos de interés compuesto, inflación, tarjetas de crédito e impuestos personales.",
      solution:
        "Una aplicación móvil con misiones semanales donde cada estudiante administra una billetera virtual frente a escenarios económicos reales.",
      technologies: ["Flutter", "Dart", "SQLite"],
      category: "Educación",
    });

    const fpIoT = { ...(await buildFingerprint(projIoT, "Expo 2026")), updatedAt: null };
    const fpFin = { ...(await buildFingerprint(projFinanzas, "Expo 2026")), updatedAt: null };

    const match = compareFingerprints(fpIoT, fpFin);
    assert.equal(match.level, "original");
    assert.equal(findMatches(fpIoT, [fpFin]).length, 0);
  });

  test("CU-14: Normalización de enlaces equivalentes (GitHub, YouTube, Google Drive) y textos cortos", () => {
    assert.equal(normalizeUrl("https://www.github.com/Equipo/Repo.git/"), "github.com/equipo/repo");
    assert.equal(normalizeUrl("https://github.com/equipo/repo/tree/main/src"), "github.com/equipo/repo");
    assert.equal(normalizeUrl("https://youtu.be/dQw4w9WgXcQ"), "youtube.com/watch/dQw4w9WgXcQ");
    assert.equal(normalizeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share"), "youtube.com/watch/dQw4w9WgXcQ");
    assert.equal(normalizeUrl("https://drive.google.com/file/d/12345/view"), "drive.google.com/file/d/12345");
    assert.equal(normalizeUrl("https://example.com/"), "");

    assert.equal(normalizeText("¡Innovación Tecnológica #2026!"), "innovacion tecnologica 2026");
    assert.ok(tokenize("El sistema de sensores monitorea las concentraciones").length >= 3);
    assert.equal(levelFor(0.8), "alto");
    assert.equal(levelFor(0.5), "medio");
    assert.equal(levelFor(0.3), "bajo");
    assert.equal(levelFor(0.1), "original");
    assert.equal(analysisState(undefined), "empty");
  });
});

describe("Casos de uso · Validación de entregas multi-archivo y utilidades", () => {
  test("CU-15: Acepta hasta 10 archivos válidos de hasta 30 MB y rechaza el archivo 11 o hashes corruptos", () => {
    const makeFile = (idx: number): FileItem => ({
      name: `archivo-${idx}.pdf`,
      size: Math.min(MAX_FILE_BYTES, idx * 1024),
      type: "application/pdf",
      sha256: idx.toString(16).padStart(64, "a"),
      storage: "supabase",
      path: `events/e1/projects/p1/prototype/uuid-${idx}_archivo-${idx}.pdf`,
    });

    const tenFiles = Array.from({ length: MAX_SUBMISSION_FILES }, (_, i) => makeFile(i + 1));
    assert.doesNotThrow(() => validateSubmissionFiles("e1", "p1", "prototype", tenFiles));

    const elevenFiles = [...tenFiles, makeFile(11)];
    assert.throws(() => validateSubmissionFiles("e1", "p1", "prototype", elevenFiles));

    const badHash = [{ ...makeFile(1), sha256: "hash-invalido" }];
    assert.throws(() => validateSubmissionFiles("e1", "p1", "prototype", badHash));
  });

  test("CU-16: Utilidades de correos, códigos de evento, categorías y formato", () => {
    assert.deepEqual(
      parseEmails(" Juez1@TEC.mx, juez2@tec.mx;\njuez1@tec.mx  invalido@ "),
      ["juez1@tec.mx", "juez2@tec.mx"],
    );
    assert.equal(isEmail("alumno@culiacan.tecnm.mx"), true);
    assert.equal(isEmail("sin-arroba.com"), false);
    assert.equal(normalizeEmail("  Demo.Alumno@Example.COM "), "demo.alumno@example.com");
    assert.equal(initials("Demo Alumno Líder"), "DA");
    assert.equal(formatBytes(500), "500 B");
    assert.equal(formatBytes(2048), "2.0 KB");
    assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
    assert.match(randomCode(6), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    assert.deepEqual(eventCategories(null), DEFAULT_CATEGORIES);
    assert.deepEqual(eventCategories(baseEvent), ["Software", "Hardware / IoT", "Salud"]);
    assert.equal(safeUrl("github.com/org/repo"), "https://github.com/org/repo");
    assert.equal(safeUrl("javascript:alert(1)"), "");
  });
});


describe("Rúbricas distintas dentro del mismo evento", () => {
  const visual: Criterion[] = [
    { id: "contenido", name: "Contenido del cartel", description: "", weight: 30 },
    { id: "diseno", name: "Diseño visual", description: "", weight: 70 },
  ];
  const funcional: Criterion[] = [
    { id: "contenido", name: "Funcionamiento", description: "", weight: 80 },
    { id: "prueba", name: "Pruebas", description: "", weight: 20 },
  ];
  const event: EventDoc = { ...baseEvent, categories: ["Carteles", "Prototipos"], categoryCriteria: { Carteles: visual, Prototipos: funcional } };
  const projects = [makeProject({ id: "cartel", category: "Carteles" }), makeProject({ id: "proto", category: "Prototipos" })];
  const evaluation = (id: string, projectId: string, scores: Record<string, number>, phase: "prototype" | "final" = "prototype"): EvaluationDoc => ({
    id, projectId, eventId: event.id, phase, judgeId: id, judgeEmail: `${id}@tec.mx`, judgeName: id,
    scores, total: 1, comment: `Comentario ${id}`, updatedAt: null,
  });
  const evaluations = [
    evaluation("j1", "cartel", { contenido: 10, diseno: 5 }),
    evaluation("j2", "cartel", { contenido: 8, diseno: 7 }),
    evaluation("j3", "proto", { contenido: 10, prueba: 5 }),
    evaluation("j4", "cartel", { contenido: 6, diseno: 6 }, "final"),
  ];

  test("la categoría selecciona exclusivamente su rúbrica, incluso con ids de criterio compartidos", () => {
    assert.deepEqual(getCategoryCriteria(event, "Carteles"), visual);
    assert.deepEqual(getCategoryCriteria(event, "Prototipos"), funcional);
    assert.equal(weightedTotal(getCategoryCriteria(event, "Carteles"), { contenido: 10, diseno: 5 }), 65);
    assert.equal(weightedTotal(getCategoryCriteria(event, "Prototipos"), { contenido: 10, prueba: 5 }), 90);
  });

  test("la rúbrica general conserva eventos antiguos y categorías aún sin personalizar", () => {
    assert.deepEqual(getCategoryCriteria(baseEvent, "Software"), baseEvent.criteria);
    assert.deepEqual(getCategoryCriteria(event, "Nueva"), baseEvent.criteria);
    assert.deepEqual(getCategoryCriteria(event, "toString"), baseEvent.criteria);
    assert.deepEqual(getCategoryCriteria({ ...event, categoryCriteria: { "Diseño 2.0 / IoT": visual } }, "Diseño 2.0 / IoT"), visual);
  });

  test("valida cada categoría y señala cuál tiene criterios incompletos", () => {
    assert.equal(categoryCriteriaError(event.categoryCriteria!), null);
    assert.match(categoryCriteriaError({ Carteles: visual, Prototipos: [] })!, /Prototipos/);
    assert.ok(categoryCriteriaError({ Carteles: [{ ...visual[0], weight: -1 }] }));
    assert.ok(categoryCriteriaError(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`Categoría ${i}`, visual]))));
  });

  test("rechaza puntuaciones de otra rúbrica, ausentes, sobrantes o fuera de escala", () => {
    assert.equal(evaluationScoresError(visual, { contenido: 8, diseno: 10 }), null);
    for (const scores of [{ contenido: 8, prueba: 10 }, { contenido: 8 }, { contenido: 8, diseno: 10, extra: 5 }, { contenido: NaN, diseno: 5 }, { contenido: 11, diseno: 5 }, { contenido: -1, diseno: 5 }] as Record<string, number>[]) {
      assert.ok(evaluationScoresError(visual, scores));
    }
  });

  test("resultados y retroalimentación promedian los criterios de cada categoría por etapa", () => {
    const standings = computeStandings(event, projects, evaluations);
    assert.equal(standings.prototype[0].projectId, "proto");
    assert.equal(standings.prototype[0].score, 90);
    const cartel = standings.prototype[1];
    assert.equal(cartel.score, 69);
    assert.equal(cartel.judges, 2);
    assert.deepEqual(cartel.criteria, { contenido: 9, diseno: 6 });
    assert.deepEqual(cartel.comments, ["Comentario j1", "Comentario j2"]);
    assert.equal(standings.final[0].score, 60);
  });

  test("ajustar los pesos de Carteles no modifica los puntajes de Prototipos", () => {
    const changed = { ...event, categoryCriteria: { ...event.categoryCriteria, Carteles: visual.map((c) => ({ ...c, weight: 50 })) } };
    const standings = computeStandings(changed, projects, evaluations);
    assert.equal(standings.prototype.find((s) => s.projectId === "cartel")!.score, 75);
    assert.equal(standings.prototype.find((s) => s.projectId === "proto")!.score, 90);
    assert.deepEqual(computeStandings({ ...event, phases: { prototype: true, final: false } }, projects, evaluations).final, []);
  });

  test("CSV diferencia las columnas por categoría aunque compartan ids", () => {
    assert.deepEqual(resultRubricColumns(event, projects).map(({ category, criterion }) => `${category}: ${criterion.name}`), [
      "Carteles: Contenido del cartel", "Carteles: Diseño visual", "Prototipos: Funcionamiento", "Prototipos: Pruebas",
    ]);
  });
});

test("un alta pendiente no se asigna a jueces ni entra en resultados aunque tenga evaluaciones anteriores", () => {
  const pending = makeProject({ registrationPending: true });
  const active = makeProject({ id: "completed", registrationPending: false });
  const event = { ...baseEvent, judgingOpen: true };
  assert.equal(isProjectAssignedToJudge(event, pending, "juez1@tec.mx"), false);
  assert.equal(isProjectAssignedToJudge(event, active, "juez1@tec.mx"), true);
  const evaluation: EvaluationDoc = { id: "old", eventId: event.id, projectId: pending.id, phase: "prototype", judgeId: "judge",
    judgeEmail: "juez1@tec.mx", judgeName: "Juez", scores: Object.fromEntries(event.criteria.map((criterion) => [criterion.id, 8])),
    total: 80, comment: "Conservar fuera del ranking", updatedAt: null };
  const results = computeStandings(event, [pending, active], [evaluation, { ...evaluation, id: "active", projectId: active.id }]);
  assert.deepEqual(results.prototype.map((row) => row.projectId), [active.id]);
  assert.equal(resultRubricColumns(event, [makeProject({ registrationPending: true, category: "" })]).some((column) => column.category === ""), false);
});
