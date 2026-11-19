import { PHASES, type EvaluationDoc, type EventDoc, type JudgeAssignment, type ProjectDoc } from "./types";
import { isProjectAssignedToJudge, normalizeEmail } from "./utils";

export const JUDGING_TIME_ZONE = "America/Mazatlan";

const inputFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: JUDGING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function localTimestamp(date: Date) {
  const parts = Object.fromEntries(inputFormat.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function scheduleInputValue(iso?: string) {
  return iso && Number.isFinite(Date.parse(iso)) ? localTimestamp(new Date(iso)).slice(0, 16) : "";
}

/** Convierte la hora del formulario usando la misma zona que la agenda. */
export function scheduleInputToIso(raw: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) return "";
  const local = raw.length === 16 ? `${raw}:00` : raw;
  const desired = Date.parse(`${local}Z`);
  if (!Number.isFinite(desired)) return "";
  let instant = desired;
  for (let attempt = 0; attempt < 3; attempt++) {
    const difference = desired - Date.parse(`${localTimestamp(new Date(instant))}Z`);
    if (!difference) break;
    instant += difference;
  }
  return localTimestamp(new Date(instant)) === local ? new Date(instant).toISOString() : "";
}

type Schedule = NonNullable<JudgeAssignment["schedule"]>;
type Slot = Schedule[string];

function scheduleInstant(value: string | undefined) {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z$/.test(value)) return NaN;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || value.startsWith("0000-")) return NaN;
  const canonical = new Date(millis).toISOString();
  return value === canonical || value === canonical.replace(".000Z", "Z") ? millis : NaN;
}

export function scheduleBounds(slot?: Slot) {
  const start = scheduleInstant(slot?.startsAt);
  const end = scheduleInstant(slot?.endsAt);
  return end > start ? { start, end } : null;
}

export function scheduleStatus(slot: Slot | undefined, now: number) {
  const bounds = scheduleBounds(slot);
  if (!bounds) return "unscheduled";
  if (now < bounds.start) return "upcoming";
  return now < bounds.end ? "due" : "overdue";
}

export function scheduleLabel(slot?: Slot) {
  const bounds = scheduleBounds(slot);
  if (!bounds) return "Sin horario asignado";
  const format = new Intl.DateTimeFormat("es-MX", { timeZone: JUDGING_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
  return `${format.format(bounds.start)} – ${format.format(bounds.end)} · Culiacán`;
}

export function scheduleError(schedule: JudgeAssignment["schedule"]) {
  const bounds = Object.values(schedule ?? {}).map(scheduleBounds);
  if (bounds.some(slot => slot === null)) return "Captura el inicio y el fin de cada turno. El fin debe ser posterior al inicio.";
  const ordered = bounds.filter(slot => slot !== null).sort((a, b) => a.start - b.start);
  if (ordered.some((slot, index) => index > 0 && slot.start < ordered[index - 1].end)) {
    return "Hay horarios que se cruzan para este evaluador. Ajusta los turnos.";
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
      const status = done ? "done" : scheduleStatus(slot, now);
      return { project, phase, slot, done, status };
    }));
  const done = tasks.filter(t => t.done).length;
  return { email: key, tasks, total: tasks.length, done, pending: tasks.length - done,
    due: tasks.filter(t => t.status === "due").length, overdue: tasks.filter(t => t.status === "overdue").length,
    percent: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
}
