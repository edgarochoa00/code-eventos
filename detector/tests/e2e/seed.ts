// Datos de prueba del detector para el emulador (nunca contra producción): histórico 2024 sellado + evento actual con 3 casos de prueba.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { buildSignals } from "@/lib/detector/signals";
import type { DetectorProject } from "@/lib/detector/types";

const AUTH = "http://127.0.0.1:9099";
const PASSWORD = "Prueba123!";
const PEOPLE = [
  { key: "super", email: "edgarochoa0173@gmail.com", name: "Edgar Ochoa" },
  { key: "adm2", email: "admin2@tec.mx", name: "Adriana Admin", staff: "admin" },
  { key: "profe", email: "profe@tec.mx", name: "Profe Organizador", staff: "organizer" },
  { key: "juez", email: "juez@tec.mx", name: "Mario Juez" },
  { key: "ana", email: "ana@tec.mx", name: "Ana Rodríguez" },
  { key: "luis", email: "luis@tec.mx", name: "Luis Pérez" },
  { key: "bea", email: "bea@tec.mx", name: "Bea Continuación" },
  { key: "carla", email: "carla@tec.mx", name: "Carla Plantilla" },
  { key: "dani", email: "dani@tec.mx", name: "Dani Nuevo" },
];

async function createUser(p: (typeof PEOPLE)[number]) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: p.email, password: PASSWORD, displayName: p.name, returnSecureToken: true }),
  });
  const j = (await r.json()) as { localId: string };
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-code/accounts:update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ localId: j.localId, emailVerified: true, displayName: p.name }),
  });
  return j.localId;
}

const ORIGINAL = {
  summary: "Sistema de riego inteligente para huertos escolares usando sensores de humedad del suelo.",
  problem:
    "Los huertos de la escuela se secan porque nadie los riega en vacaciones y además se desperdicia mucha agua al regar de más sin medir la humedad.",
  solution:
    "Un Arduino con sensores de humedad del suelo activa una bomba de agua solo cuando la tierra está seca y envía alertas a una aplicación móvil con el historial de riego.",
};
const COMPOSTA = {
  summary: "Compostero automático que mide temperatura y humedad para acelerar la descomposición de residuos orgánicos.",
  problem:
    "La cafetería tira kilos de residuos orgánicos cada semana y el compost manual tarda meses porque nadie controla la temperatura ni la ventilación.",
  solution:
    "Un tambor giratorio con sensores de temperatura y un ventilador controlado por ESP32 mantiene las condiciones ideales y avisa cuándo voltear la mezcla.",
};
const CRITERIA = [
  { id: "innovacion", name: "Innovación", description: "Qué tan original y novedosa es la propuesta.", weight: 50 },
  { id: "tecnica", name: "Viabilidad técnica", description: "Calidad de la solución.", weight: 50 },
];

function project(id: string, eventId: string, title: string, text: typeof ORIGINAL, members: string[], extra: Partial<DetectorProject> = {}, links: string[] = [], createdAt = Timestamp.now()) {
  return {
    id,
    eventId,
    title,
    ...text,
    technologies: ["Arduino"],
    category: "Hardware / IoT",
    leaderId: members[0],
    leaderEmail: members[0],
    members: members.map((email) => ({ name: email.split("@")[0], email })),
    memberEmails: members,
    prototype: links.length
      ? { description: "Prototipo funcional presentado en la expo.", links: links.map((url) => ({ label: "Repositorio", url })), files: [], submittedAt: createdAt, submittedBy: members[0] }
      : null,
    final: null,
    declaration: null,
    createdAt,
    updatedAt: createdAt,
    ...extra,
  } as unknown as DetectorProject;
}

async function main() {
  const uid: Record<string, string> = {};
  for (const p of PEOPLE) uid[p.key] = await createUser(p);

  const env = await initializeTestEnvironment({ projectId: "demo-code", firestore: { host: "127.0.0.1", port: 8085 } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const p of PEOPLE) {
      await setDoc(doc(db, "users", uid[p.key]), { uid: uid[p.key], email: p.email, displayName: p.name, photoURL: "", lastLoginAt: Timestamp.now() });
      if (p.staff) await setDoc(doc(db, "staff", p.email), { email: p.email, role: p.staff, updatedBy: "seed", updatedAt: Timestamp.now() });
    }
    const event = (id: string, name: string, owner: string, ownerEmail: string, over: Record<string, unknown>) =>
      setDoc(doc(db, "events", id), {
        name,
        description: "Los proyectos deben resolver un problema real de la comunidad escolar usando tecnología accesible.",
        institution: "Instituto Tecnológico de Culiacán",
        code: id.toUpperCase().slice(0, 6),
        ownerId: owner,
        ownerEmail,
        organizerEmails: [ownerEmail],
        judgeEmails: [],
        phases: { prototype: true, final: true },
        submissions: { prototype: true, final: false },
        registrationOpen: true,
        judgingOpen: true,
        maxTeamSize: 5,
        criteria: CRITERIA,
        startDate: "2026-11-10",
        endDate: "2026-11-14",
        resultsPublished: false,
        results: null,
        createdAt: Timestamp.now(),
        ...over,
      });

    // Histórico 2024, ya sellado (índice + pares de palabras)
    const t2024 = Timestamp.fromDate(new Date("2024-10-05T10:00:00Z"));
    await event("e2024", "Expo Proyectos 2024", uid.super, "edgarochoa0173@gmail.com", {
      registrationOpen: false,
      submissions: { prototype: false, final: false },
      judgingOpen: false,
      resultsPublished: true,
      startDate: "2024-11-10",
      endDate: "2024-11-12",
    });
    const historical = [
      project("old_aqua", "e2024", "AquaSense", ORIGINAL, ["exalumno@tec.mx"], {}, ["https://github.com/equipo-agua/aquasense"], t2024),
      project("old_bea", "e2024", "Composta Inteligente", COMPOSTA, ["bea@tec.mx"], {}, [], t2024),
      project(
        "old_tpl",
        "e2024",
        "Agenda Escolar",
        {
          summary: "Agenda digital para organizar tareas y exámenes de todas las materias del semestre.",
          problem: "Los alumnos olvidan entregas porque cada maestro publica tareas en un lugar distinto.",
          solution: "Una aplicación que junta las tareas de todas las plataformas y manda recordatorios un día antes.",
        },
        ["otro@tec.mx"],
        {},
        ["https://github.com/plantillas/expo-starter"],
        t2024,
      ),
    ];
    const entries = [];
    for (const p of historical) {
      const { id, ...data } = p as DetectorProject & { id: string };
      await setDoc(doc(db, "events/e2024/projects", id), data);
      const s = await buildSignals(p);
      const { shingles, contentHash: _c, ...rest } = s;
      void _c;
      entries.push({ ...rest, projectId: id, eventId: "e2024", year: 2024, firstSeenAt: t2024.toMillis() });
      await setDoc(doc(db, "originalityShingles", id), { projectId: id, eventId: "e2024", shingles, sealedAt: Timestamp.now() });
    }
    await setDoc(doc(db, "originalityIndex", "e2024"), {
      eventId: "e2024",
      eventName: "Expo Proyectos 2024",
      year: 2024,
      chunk: 0,
      entries,
      sealedBy: "seed",
      sealedAt: Timestamp.now(),
    });

    // Evento actual
    await event("e1", "Expo Proyectos 2026", uid.profe, "profe@tec.mx", { judgeEmails: ["juez@tec.mx"] });
    const current = [
      // 1) Copia: mismo texto y mismo repositorio que AquaSense 2024 → debe abrir caso
      project("p_eco", "e1", "EcoRiego", ORIGINAL, ["ana@tec.mx", "luis@tec.mx"], {}, ["github.com/equipo-agua/aquasense.git"]),
      // 2) Continuación: Bea retoma su propio proyecto de 2024 → NO debe abrir caso
      project("p_bea", "e1", "Composta 2.0", COMPOSTA, ["bea@tec.mx"]),
      // 3) Plantilla declarada: mismo enlace que otro de 2024, pero declarado → NO debe abrir caso
      project(
        "p_carla",
        "e1",
        "Bitácora de Laboratorio",
        {
          summary: "Bitácora digital para registrar prácticas de laboratorio con fotos y mediciones.",
          problem: "Las bitácoras en papel se pierden y los maestros no pueden revisar las mediciones a tiempo.",
          solution: "Una app móvil que guarda cada práctica con fotos, mediciones y firma del maestro responsable.",
        },
        ["carla@tec.mx"],
        { declaration: { continues: "", sources: "Plantilla base: https://github.com/plantillas/expo-starter" } },
        ["https://github.com/plantillas/expo-starter"],
      ),
    ];
    for (const p of current) {
      const { id, ...data } = p as DetectorProject & { id: string };
      await setDoc(doc(db, "events/e1/projects", id), data);
    }
  });
  await env.cleanup();
  console.log("seed detector ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
