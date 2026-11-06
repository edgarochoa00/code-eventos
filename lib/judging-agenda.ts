import { PHASES, type EvaluationDoc, type EventDoc, type JudgeAssignment, type ProjectDoc } from "./types";
import { isProjectAssignedToJudge, normalizeEmail } from "./utils";

export const JUDGING_TIME_ZONE = "America/Mazatlan";
export function scheduleLabel(slot?: { startsAt: string; endsAt: string }) {
  if (!slot || !Number.isFinite(Date.parse(slot.startsAt)) || !Number.isFinite(Date.parse(slot.endsAt))) return "Sin horario asignado";
  const format = new Intl.DateTimeFormat("es-MX", { timeZone: JUDGING_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
  return `${format.format(new Date(slot.startsAt))} – ${format.format(new Date(slot.endsAt))} · Culiacán`;
}
export function scheduleError(schedule: JudgeAssignment["schedule"]) {
  const slots = Object.values(schedule ?? {}).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  for (let i = 0; i < slots.length; i++) {
    const start = Date.parse(slots[i].startsAt), end = Date.parse(slots[i].endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "La hora de fin debe ser posterior al inicio.";
    if (i && start < Date.parse(slots[i - 1].endsAt)) return "Hay horarios que se cruzan para este juez. Ajusta los turnos.";
  }
  return null;
}
export function judgeProgress(event: EventDoc, projects: ProjectDoc[], evaluations: EvaluationDoc[], email: string, now: number) {
  const key = normalizeEmail(email);
  const assignment = event.judgeAssignments?.[key];
  const tasks = projects.filter(p => isProjectAssignedToJudge(event, p, key)).flatMap(project =>
    PHASES.filter(phase => event.phases[phase]).map(phase => {
      const done = evaluations.some(e => normalizeEmail(e.judgeEmail) === key && e.projectId === project.id && e.phase === phase);
      const slot = assignment?.schedule?.[project.id];
      const start = slot ? Date.parse(slot.startsAt) : NaN, end = slot ? Date.parse(slot.endsAt) : NaN;
      const status = done ? "done" : !Number.isFinite(start) || !Number.isFinite(end) ? "unscheduled"
        : now < start ? "upcoming" : now < end ? "due" : "overdue";
      return { project, phase, slot, done, status };
    }));
  const done = tasks.filter(t => t.done).length;
  return { email: key, tasks, total: tasks.length, done, pending: tasks.length - done,
    due: tasks.filter(t => t.status === "due").length, overdue: tasks.filter(t => t.status === "overdue").length,
    percent: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
}
