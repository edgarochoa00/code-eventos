import type { EventDoc, ProjectDoc } from "./types";

/** Se valida de nuevo con el evento y el proyecto actuales dentro de la transacción. */
export function projectJudgesError(event: EventDoc, project: ProjectDoc, judging: NonNullable<ProjectDoc["judging"]>) {
  if (event.resultsPublished) return "Oculta los resultados antes de cambiar los jueces.";
  if (project.registrationPending) return "El equipo debe completar su registro antes de asignarle jueces.";
  if (!Number.isSafeInteger(judging.maxJudges) || judging.maxJudges < 1) return "Indica un máximo entero de al menos un juez.";
  if (judging.judgeEmails.length > judging.maxJudges) return "La cantidad de jueces seleccionados supera el máximo del proyecto.";
  if (new Set(judging.judgeEmails).size !== judging.judgeEmails.length) return "No se puede asignar al mismo juez dos veces.";
  if (judging.judgeEmails.some(email => !event.judgeEmails.includes(email) || event.organizerEmails.includes(email) || project.memberEmails.includes(email))) {
    return "Solo puedes seleccionar jueces vigentes que no organicen ni participen en el proyecto.";
  }
  return null;
}
