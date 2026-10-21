/**
 * Tipos del detector de originalidad (anclas + casos con revisión humana).
 * Al activar, esta carpeta se mueve a lib/detector/ (ver detector/ACTIVAR.md).
 */
import type { Timestamp } from "firebase/firestore";
import type { EventDoc, ProjectDoc } from "@/lib/types";

/* ---------- Datos que agrega el detector a un proyecto ---------- */

/** Lo que el equipo declara al registrar: evita alertas por reuso legítimo. */
export type Declaration = {
  /** Si continúa un proyecto anterior: nombre, año o enlace. Vacío si es nuevo. */
  continues: string;
  /** Plantillas, librerías o código de terceros que usa (enlaces o texto). */
  sources: string;
};

/** Marca que el organizador escribe en el proyecto cuando un caso se confirma. */
export type OriginalityStatus = {
  status: "confirmado";
  outcome: CaseOutcome;
  caseId: string;
  at: Timestamp | null;
};

export type DetectorProject = ProjectDoc & {
  declaration?: Declaration | null;
  originalityStatus?: OriginalityStatus | null;
};

/* ---------- Señales (huella) ---------- */

export type AnchorSignals = {
  /** MinHash de pares de palabras: filtro rápido de candidatos */
  sigPhrases: number[];
  /** MinHash de palabras: parecido de tema (solo informativo) */
  sigWords: number[];
  tokenCount: number;
  /** Hash de cada par de palabras: comparación exacta y resaltado */
  shingles: number[];
  /** SHA-256 de enlaces normalizados (nunca se guarda el enlace) */
  urls: string[];
  /** SHA-256 de archivos entregados */
  files: string[];
  /** SHA-256 de correos de integrantes: detecta continuación del mismo equipo */
  members: string[];
  /** SHA-256 de enlaces declarados como fuentes de terceros */
  declaredUrls: string[];
  /** SHA-256 del texto completo normalizado */
  contentHash: string;
};

/**
 * Ancla: versión inmutable con hora del servidor.
 * Ruta: events/{eventId}/projects/{projectId}/anchors/{anchorId}
 */
export type AnchorKind = "registro" | "edicion" | "prototype" | "final" | "sello";

export type AnchorDoc = AnchorSignals & {
  id: string;
  projectId: string;
  eventId: string;
  kind: AnchorKind;
  source: "equipo" | "organizador";
  createdBy: string;
  createdAt: Timestamp | null;
};

/** Entrada del índice compacto. Ruta: originalityIndex/{eventId} y {eventId}__N */
export type IndexEntry = Omit<AnchorSignals, "shingles" | "contentHash"> & {
  projectId: string;
  eventId: string;
  year: number;
  /** ms: primera aparición del proyecto (createdAt con hora del servidor) */
  firstSeenAt: number;
};

export type IndexDoc = {
  id: string;
  eventId: string;
  eventName: string;
  year: number;
  chunk: number;
  entries: IndexEntry[];
  sealedBy: string;
  sealedAt: Timestamp | null;
};

/** Pares de palabras de un proyecto sellado. Ruta: originalityShingles/{projectId} */
export type ShinglesDoc = {
  projectId: string;
  eventId: string;
  shingles: number[];
  sealedAt: Timestamp | null;
};

/* ---------- Evidencia ---------- */

/** De más fuerte a más débil. Solo archivo, enlace y texto generan caso. */
export type EvidenceLevel = "archivo" | "enlace" | "texto" | "tema" | "ninguna";

export type Evidence = {
  level: EvidenceLevel;
  alert: boolean;
  files: number;
  links: number;
  phrases: {
    /** pares de palabras en común (después de filtros) */
    shared: number;
    /** pares de palabras de este proyecto */
    total: number;
    /** shared / total */
    containment: number;
  };
  /** parecido de vocabulario 0..1 (estimado) */
  topic: number;
  continuation: boolean;
  reasons: string[];
};

/* ---------- Casos ---------- */

export type CaseStatus = "por_revisar" | "esperando_equipo" | "en_revision" | "propuesta" | "descartado" | "confirmado";

export type CaseOutcome = "sin_efecto" | "aviso_jueces" | "penalizacion" | "descalificacion";

export type CaseActor = { by: string; byEmail: string; at: Timestamp | null };

/** Ruta: events/{eventId}/cases/{projectId}__{otherProjectId} */
export type CaseDoc = {
  id: string;
  eventId: string;
  projectId: string;
  otherProjectId: string;
  otherEventId: string;
  otherYear: number;
  firstSeenAt: number;
  otherFirstSeenAt: number;
  evidence: Evidence;
  /** pares de palabras coincidentes: permiten resaltar el texto propio sin ver el ajeno */
  matchedShingles: number[];
  status: CaseStatus;
  teamNotified: boolean;
  teamResponse: (CaseActor & { text: string; links: string[] }) | null;
  proposal: (CaseActor & { outcome: CaseOutcome; reason: string }) | null;
  decision: (CaseActor & { outcome: CaseOutcome; reason: string }) | null;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

/** Historial inmutable. Ruta: events/{eventId}/cases/{caseId}/log/{logId} */
export type CaseLogDoc = {
  id: string;
  action: string;
  note: string;
  by: string;
  byEmail: string;
  at: Timestamp | null;
};

/* ---------- Detección ---------- */

/** Proyecto del evento actual leído en vivo (lo ve el organizador). */
export type LiveProject = {
  project: DetectorProject;
  signals: AnchorSignals;
  firstSeenAt: number;
};

/** Cualquier proyecto con el que se compara: del evento actual o del índice histórico. */
export type Comparable = Omit<AnchorSignals, "shingles" | "contentHash"> & {
  projectId: string;
  eventId: string;
  year: number;
  firstSeenAt: number;
};

export type Alert = {
  projectId: string;
  other: Comparable;
  evidence: Evidence;
  matchedShingles: number[];
  firstSeenAt: number;
};

export type DetectorContext = {
  event: EventDoc;
  live: LiveProject[];
};
