import { PHASE_LABEL, PHASES, type Criterion, type EventDoc, type Phase, type PhaseDetails } from "./types";

type EventDeliveries = Pick<EventDoc, "phaseDetails">;

/** Conserva el significado de las entregas históricas sin migrar sus archivos ni calificaciones. */
export function getPhaseDetails(event: EventDeliveries | null | undefined, phase: Phase): PhaseDetails {
  return event?.phaseDetails?.[phase] ?? {
    name: PHASE_LABEL[phase],
    description: phase === "prototype"
      ? "Qué funciona ya, qué falta y cómo lo probaron."
      : "Qué entregan, cómo se usa y qué resultados obtuvieron.",
  };
}

export function getPhaseLabel(event: EventDeliveries | null | undefined, phase: Phase) {
  return getPhaseDetails(event, phase).name;
}

export function deliverySettingsError(event: Pick<EventDoc, "phases" | "phaseDetails">): string | null {
  const phases = PHASES.filter((phase) => event.phases[phase]);
  if (!phases.length) return "Activa al menos una entrega para este evento.";
  const details = phases.map((phase) => event.phaseDetails?.[phase]);
  if (details.some((detail) => !detail?.name.trim())) return "Escribe el nombre de cada entrega activa.";
  if (details.some((detail) => detail!.name.trim().length > 80 || detail!.description.length > 2000)) {
    return "Usa hasta 80 caracteres para el nombre y 2000 para las instrucciones de cada entrega.";
  }
  const names = details.map((detail) => detail!.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return "Usa un nombre distinto para cada entrega.";
  return null;
}

export function criteriaError(criteria: Criterion[]): string | null {
  if (!criteria.length) return "Define al menos un criterio de evaluación para este evento.";
  if (criteria.length > 20) return "Máximo 20 criterios por evento.";
  if (criteria.some((c) => !c.id || !c.name.trim())) return "Todos los criterios necesitan nombre.";
  if (new Set(criteria.map((c) => c.id)).size !== criteria.length) return "Los criterios deben tener identificadores distintos.";
  if (criteria.some((c) => !Number.isFinite(c.weight) || c.weight < 0 || c.weight > 100)) {
    return "Cada peso debe estar entre 0 y 100.";
  }
  if (criteria.reduce((sum, c) => sum + c.weight, 0) <= 0) return "La suma de pesos debe ser mayor a 0.";
  return null;
}
