import type { Timestamp } from "firebase/firestore";

export type Phase = "prototype" | "final";

export const PHASES: Phase[] = ["prototype", "final"];

export const PHASE_LABEL: Record<Phase, string> = {
  prototype: "Prototipo",
  final: "Producto final",
};

export type Criterion = {
  id: string;
  name: string;
  description: string;
  /** Peso relativo; se normaliza al calcular el total. */
  weight: number;
};

export type ResultRow = {
  projectId: string;
  title: string;
  score: number;
  judges: number;
};

export type EventDoc = {
  id: string;
  name: string;
  description: string;
  institution: string;
  code: string;
  ownerId: string;
  ownerEmail: string;
  organizerEmails: string[];
  judgeEmails: string[];
  phases: Record<Phase, boolean>;
  submissions: Record<Phase, boolean>;
  registrationOpen: boolean;
  judgingOpen: boolean;
  maxTeamSize: number;
  criteria: Criterion[];
  startDate: string;
  endDate: string;
  resultsPublished: boolean;
  results: Record<Phase, ResultRow[]> | null;
  /** Opcional: eventos creados antes de esta opción usan DEFAULT_ORIGINALITY */
  originality?: OriginalitySettings;
  createdAt: Timestamp | null;
};

export type LinkItem = { label: string; url: string };

export type FileItem = {
  name: string;
  size: number;
  type: string;
  sha256: string;
  /** Solo existe si Storage está habilitado y el archivo se subió. */
  url?: string;
  path?: string;
};

export type Submission = {
  description: string;
  links: LinkItem[];
  files: FileItem[];
  submittedAt: Timestamp | null;
  submittedBy: string;
};

export type Member = { name: string; email: string };

export type PhaseFeedback = {
  score: number;
  judges: number;
  rank: number;
  of: number;
  comments: string[];
  criteria: Record<string, number>;
};

export type ProjectDoc = {
  id: string;
  eventId: string;
  title: string;
  summary: string;
  problem: string;
  solution: string;
  technologies: string[];
  category: string;
  leaderId: string;
  leaderEmail: string;
  members: Member[];
  memberEmails: string[];
  prototype: Submission | null;
  final: Submission | null;
  feedback?: Partial<Record<Phase, PhaseFeedback>>;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type EvaluationDoc = {
  id: string;
  eventId: string;
  projectId: string;
  phase: Phase;
  judgeId: string;
  judgeEmail: string;
  judgeName: string;
  scores: Record<string, number>;
  total: number;
  comment: string;
  updatedAt: Timestamp | null;
};

export type FingerprintDoc = {
  projectId: string;
  eventId: string;
  eventName: string;
  title: string;
  year: number;
  /** MinHash sobre pares de palabras (detecta texto copiado). */
  sigPhrases: number[];
  /** MinHash sobre palabras sueltas (detecta reescrituras ligeras). */
  sigWords: number[];
  /** SHA-256 de cada enlace normalizado (no se guarda el enlace para no exponerlo). */
  urls: string[];
  fileHashes: string[];
  tokenCount: number;
  updatedAt: Timestamp | null;
};

export type EventRole = "organizer" | "judge" | "student";

/* ---------- Permisos globales ---------- */

/** Cuenta dueña de la plataforma. Debe coincidir con firestore.rules. */
export const SUPERADMIN_EMAIL = "edgarochoa0173@gmail.com";

/**
 * Permisos que asigna el superadmin (colección staff/{correo}):
 *   admin      administra todos los eventos, jueces y ve a todos los usuarios
 *   organizer  puede crear sus propios eventos
 *   blocked    cuenta suspendida
 */
export type StaffRole = "admin" | "organizer" | "blocked";
export type GlobalRole = "superadmin" | StaffRole | "user";

export const GLOBAL_ROLE_LABEL: Record<GlobalRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  organizer: "Organizador",
  blocked: "Suspendido",
  user: "Usuario",
};

export type StaffDoc = {
  email: string;
  role: StaffRole;
  updatedBy: string;
  updatedAt: Timestamp | null;
};

export type UserDoc = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastLoginAt: Timestamp | null;
};

/* ---------- Visibilidad de originalidad ---------- */

/** Cuándo ven los jueces el análisis de originalidad. */
export type JudgeOriginality = "always" | "judging";
/** Cuándo ve cada equipo el análisis de su propio proyecto. */
export type TeamOriginality = "hidden" | "results" | "date";

export type OriginalitySettings = {
  judges: JudgeOriginality;
  teams: TeamOriginality;
  /** AAAA-MM-DD, solo si teams === "date" */
  teamsFrom: string;
};

export const DEFAULT_ORIGINALITY: OriginalitySettings = { judges: "always", teams: "hidden", teamsFrom: "" };
