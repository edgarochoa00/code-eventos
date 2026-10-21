/**
 * Política del detector. Son decisiones de la escuela, no técnicas.
 * Antes de activar, confirma cada valor con el usuario (ver detector/ACTIVAR.md, paso 0).
 */
import type { CaseOutcome } from "./types";

export type ConfirmationMode = "organizador" | "organizador+admin";

export const DETECTOR_POLICY = {
  /**
   * ¿Un equipo puede continuar su propio proyecto de años anteriores?
   * true: si comparten integrantes no se abre caso (solo se informa como continuación).
   * PENDIENTE DE CONFIRMAR CON EL USUARIO.
   */
  allowContinuation: true,

  /**
   * Quién confirma un caso.
   * "organizador+admin": el organizador propone y un admin distinto confirma (recomendado).
   * "organizador": el organizador confirma solo.
   * Si cambias esto, cambia también canConfirm() en firestore.rules (ver ACTIVAR.md).
   * PENDIENTE DE CONFIRMAR CON EL USUARIO.
   */
  confirmation: "organizador+admin" as ConfirmationMode,

  /** ¿El equipo puede responder antes de la decisión? PENDIENTE DE CONFIRMAR. */
  teamCanRespond: true,

  /** Consecuencias disponibles al confirmar. PENDIENTE DE CONFIRMAR cuáles aplica la escuela. */
  outcomes: ["sin_efecto", "aviso_jueces", "penalizacion", "descalificacion"] as CaseOutcome[],

  /** ¿Los jueces ven la marca de un caso confirmado en el proyecto? */
  judgesSeeConfirmed: true,

  thresholds: {
    /** Parte de las frases del proyecto que aparecen en el otro para abrir caso por texto */
    phraseContainment: 0.3,
    /** Mínimo de pares de palabras en común (evita alertas por textos muy cortos) */
    minSharedShingles: 8,
    /** Vocabulario en común a partir del cual se informa "tema parecido" (nunca abre caso) */
    topic: 0.35,
    /** Filtro rápido con MinHash antes de la comparación exacta */
    candidatePhrases: 0.08,
    candidateWords: 0.25,
    /** Frase común: aparece en al menos esta fracción de proyectos del evento... */
    commonRatio: 0.3,
    /** ...y en al menos este número de proyectos */
    commonMinDocs: 3,
  },
} as const;

export const OUTCOME_LABEL: Record<CaseOutcome, string> = {
  sin_efecto: "Sin efecto en la calificación",
  aviso_jueces: "Aviso a los jueces",
  penalizacion: "Penalización en puntos",
  descalificacion: "Descalificación",
};

export const STATUS_LABEL = {
  por_revisar: "Por revisar",
  esperando_equipo: "Esperando al equipo",
  en_revision: "En revisión",
  propuesta: "Propuesta de confirmación",
  descartado: "Descartado",
  confirmado: "Confirmado",
} as const;
