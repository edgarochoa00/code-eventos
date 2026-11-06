import type { EvaluationDoc, EventDoc, Phase, ProjectDoc, ResultRow } from "./types";
import { getCategoryCriteria } from "./event-config";
import { effectiveEvaluationTotal, eventCategories } from "./utils";

/** Incluye la categoría en cada columna para distinguir criterios con el mismo nombre o id. */
export function resultRubricColumns(event: EventDoc, projects: ProjectDoc[]) {
  return [...new Set([...eventCategories(event), ...projects.filter((p) => !p.registrationPending).map((p) => p.category)])]
    .flatMap((category) => getCategoryCriteria(event, category).map((criterion) => ({ category, criterion })));
}

export type PhaseStanding = ResultRow & { criteria: Record<string, number>; comments: string[] };

export function computeStandings(
  event: EventDoc,
  projects: ProjectDoc[],
  evaluations: EvaluationDoc[],
): Record<Phase, PhaseStanding[]> {
  const out: Record<Phase, PhaseStanding[]> = { prototype: [], final: [] };
  for (const phase of ["prototype", "final"] as Phase[]) {
    if (!event.phases[phase]) continue;
    for (const p of projects) {
      if (p.registrationPending) continue;
      const evs = evaluations.filter((e) => e.projectId === p.id && e.phase === phase);
      if (!evs.length) continue;
      const criteria: Record<string, number> = {};
      for (const c of getCategoryCriteria(event, p.category)) {
        const values = evs.map((e) => e.scores[c.id]).filter((v): v is number => typeof v === "number");
        if (values.length) criteria[c.id] = round1(values.reduce((a, b) => a + b, 0) / values.length);
      }
      out[phase].push({
        projectId: p.id,
        title: p.title,
        category: p.category,
        score: round1(evs.reduce((a, e) => a + effectiveEvaluationTotal(getCategoryCriteria(event, p.category), e), 0) / evs.length),
        judges: evs.length,
        criteria,
        comments: evs.map((e) => e.comment).filter(Boolean),
      });
    }
    out[phase].sort((a, b) => b.score - a.score);
  }
  return out;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
