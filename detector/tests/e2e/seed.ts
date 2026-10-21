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

// Textos y nombres inventados para las pruebas (no corresponden a proyectos reales)
const ORIGINAL = {
  summary: "Medidor de ruido para salones de clase que avisa con luces cuando el volumen es demasiado alto.",
  problem:
    "En los salones grandes el ruido no deja escuchar al maestro y nadie se da cuenta de cuándo el volumen pasa de lo tolerable durante las actividades en equipo.",
  solution:
    "Un micrófono conectado a una placa Arduino mide el nivel de ruido cada segundo, enciende una tira de luces de colores cuando pasa el límite y guarda un registro que el maestro consulta desde el celular.",
};
const BEA_2024 = {
  summary: "Dispensador automático de gel que cuenta los usos y avisa cuando se está terminando.",
  problem:
    "En los baños y laboratorios el gel se acaba sin que nadie lo note y pasan días antes de que alguien vuelva a llenar el dispensador.",
  solution:
    "Un sensor infrarrojo activa el dispensador sin tocarlo, un contador registra cada uso y un ESP32 manda un aviso al personal de limpieza cuando queda poco.",
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
      project("old_alfa", "e2024", "Proyecto Alfa", ORIGINAL, ["exalumno@tec.mx"], {}, ["https://github.com/equipo-alfa/proyecto-alfa"], t2024),
      project("old_bea", "e2024", "Proyecto Gamma", BEA_2024, ["bea@tec.mx"], {}, [], t2024),
      project(
        "old_tpl",
        "e2024",
        "Proyecto Delta",
        {
          summary: "Tablero digital para la cafetería que muestra el menú del día y los precios actualizados.",
          problem: "Los alumnos hacen fila sin saber qué hay de comer y los precios escritos a mano casi nunca están al día.",
          solution: "Una pantalla conectada a una página web donde la cafetería actualiza el menú, los precios y los platillos agotados.",
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
      // 1) Copia: mismo texto y mismo repositorio que Proyecto Alfa 2024 → debe abrir caso
      project("p_beta", "e1", "Proyecto Beta", ORIGINAL, ["ana@tec.mx", "luis@tec.mx"], {}, ["github.com/equipo-alfa/proyecto-alfa.git"]),
      // 2) Continuación: Bea retoma su propio proyecto de 2024 → NO debe abrir caso
      project("p_bea", "e1", "Proyecto Gamma 2.0", BEA_2024, ["bea@tec.mx"]),
      // 3) Plantilla declarada: mismo enlace que otro de 2024, pero declarado → NO debe abrir caso
      project(
        "p_carla",
        "e1",
        "Proyecto Épsilon",
        {
          summary: "Mapa interactivo del campus para encontrar salones, oficinas y laboratorios.",
          problem: "Los alumnos de nuevo ingreso se pierden buscando salones y llegan tarde a sus primeras clases.",
          solution: "Una app móvil con el plano del campus, búsqueda de salones por nombre y rutas a pie desde la entrada principal.",
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
