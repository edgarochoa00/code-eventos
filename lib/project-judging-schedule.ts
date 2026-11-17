import { scheduleBounds, scheduleError, scheduleLabel } from "./judging-agenda";
import type { EventDoc, JudgeAssignment, ProjectDoc } from "./types";
import { isProjectAssignedToJudge, normalizeEmail } from "./utils";

export type JudgingSlot = NonNullable<JudgeAssignment["schedule"]>[string];

export function projectJudgeEmails(event: EventDoc, project: ProjectDoc) {
  return [...new Set(event.judgeEmails.map(normalizeEmail))]
    .filter(email => isProjectAssignedToJudge(event, project, email));
}

/** Construye todos los cambios antes de escribir: un conflicto impide guardar el grupo completo. */
export function projectScheduleAssignments(event: EventDoc, project: ProjectDoc, slot: JudgingSlot | null, expectedJudges: string[]) {
  if (event.accessVersion !== 1 || event.resultsPublished) throw new Error("Los horarios no se pueden cambiar en este momento.");
  if (project.registrationPending) throw new Error("El equipo debe completar su registro antes de programar su turno.");
  const judges = projectJudgeEmails(event, project);
  if (!judges.length) throw new Error("Asigna jueces al proyecto antes de programar su turno.");
  const expected = new Set(expectedJudges.map(normalizeEmail));
  if (judges.length !== expected.size || judges.some(email => !expected.has(email))) {
    throw new Error("Los jueces asignados cambiaron. Cierra y vuelve a abrir el turno para revisar a quiénes se aplicará.");
  }
  if (slot && !scheduleBounds(slot)) throw new Error("Captura el inicio y el fin del turno. El fin debe ser posterior al inicio.");
  const next = { ...event.judgeAssignments };
  for (const email of judges) {
    const current = next[email] ?? {};
    const schedule = { ...current.schedule };
    if (slot) {
      const bounds = scheduleBounds(slot)!;
      const conflict = Object.entries(schedule).find(([id, other]) => {
        const otherBounds = scheduleBounds(other);
        return id !== project.id && otherBounds && bounds.start < otherBounds.end && otherBounds.start < bounds.end;
      });
      if (conflict) throw new Error(`${email} ya tiene otro proyecto en un horario que se cruza: ${scheduleLabel(conflict[1])}. Ajusta el turno o su agenda individual.`);
      schedule[project.id] = { ...slot };
      const error = scheduleError(schedule);
      if (error) throw new Error(`${email}: ${error}`);
    } else {
      delete schedule[project.id];
    }
    next[email] = { ...current, schedule };
  }
  return next;
}
