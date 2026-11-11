import { PHASE_LABEL, PHASES, type Criterion, type EventDoc, type Phase, type PhaseDetails } from "./types";

type EventDeliveries = Partial<Pick<EventDoc, "phases" | "phaseDetails">>;

/** Conserva el significado de las entregas históricas sin migrar sus archivos ni calificaciones. */
export function getPhaseDetails(event: EventDeliveries | null | undefined, phase: Phase): PhaseDetails {
  if (event?.phaseDetails?.[phase]) return event.phaseDetails[phase]!;
  if (phase === "prototype" && event?.phases && !event.phases.final) {
    return { name: "Entrega", description: "" };
  }
  return {
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
  if (!criteria.length) return "Define al menos un criterio de evaluación para esta rúbrica.";
  if (criteria.length > 20) return "Máximo 20 criterios por rúbrica.";
  if (criteria.some((c) => !c.id || !c.name.trim())) return "Todos los criterios necesitan nombre.";
  if (new Set(criteria.map((c) => c.id)).size !== criteria.length) return "Los criterios deben tener identificadores distintos.";
  if (criteria.some((c) => !Number.isFinite(c.weight) || c.weight < 0 || c.weight > 100)) {
    return "Cada peso debe estar entre 0 y 100.";
  }
  if (criteria.reduce((sum, c) => sum + c.weight, 0) <= 0) return "La suma de pesos debe ser mayor a 0.";
  return null;
}

/** La categoría del proyecto determina su rúbrica; los eventos históricos mantienen la general. */
export function getCategoryCriteria(event: Pick<EventDoc, "criteria" | "categoryCriteria">, category: string): Criterion[] {
  const criteria = event.categoryCriteria && Object.hasOwn(event.categoryCriteria, category)
    ? event.categoryCriteria[category]
    : event.criteria;
  return criteria.map(({ id, name, description, weight }) => ({ id, name, description, weight }));
}

export function sameCriteria(a: Criterion[], b: Criterion[]): boolean {
  return a.length === b.length && a.every((c, i) => (
    c.id === b[i]?.id &&
    c.name === b[i]?.name &&
    c.description === b[i]?.description &&
    c.weight === b[i]?.weight
  ));
}

export function categoryCriteriaError(rubrics: Record<string, Criterion[]>): string | null {
  if (Object.keys(rubrics).length > 20) return "Máximo 20 rúbricas por evento.";
  for (const [category, criteria] of Object.entries(rubrics)) {
    if (!category.trim() || category.length > 40) return "Usa nombres de categoría de hasta 40 caracteres.";
    const error = criteriaError(criteria);
    if (error) return `${category}: ${error}`;
  }
  return null;
}

export function cleanCriteria(criteria: Criterion[]): Criterion[] {
  return criteria.map((c) => ({ ...c, name: c.name.trim(), description: c.description.trim() }));
}

/** Rechaza formularios desactualizados y evita mezclar puntuaciones de otra categoría. */
export function evaluationScoresError(criteria: Criterion[], scores: Record<string, number>): string | null {
  if (Object.keys(scores).length !== criteria.length || criteria.some((c) => !Object.hasOwn(scores, c.id))) {
    return "La rúbrica cambió. Recarga el proyecto y califica todos sus criterios.";
  }
  if (Object.values(scores).some((score) => !Number.isFinite(score) || score < 0 || score > 10)) {
    return "Cada calificación debe estar entre 0 y 10.";
  }
  return null;
}
