import { ArrowUpRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { scheduleBounds } from "@/lib/judging-agenda";
import type { EventDoc, EventRole } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "./ui";

const ROLE_LABEL: Record<EventRole, string> = { organizer: "Organizador", judge: "Evaluador", student: "Alumno" };

export function EventStatus({ event, role }: { event: EventDoc; role?: EventRole }) {
  if (event.resultsPublished) {
    return role === "student" ? <Badge>Cerrado</Badge> : <Badge tone="dark">Resultados publicados</Badge>;
  }
  if (event.submissions.prototype || event.submissions.final) return <Badge tone="green">Entregas abiertas</Badge>;
  if (event.registrationOpen) return <Badge tone="green">Registro abierto</Badge>;
  const hasSchedule = Object.values(event.judgeAssignments ?? {}).some(assignment =>
    Object.values(assignment.schedule ?? {}).some(scheduleBounds),
  );
  if (hasSchedule) return <Badge tone="lime">Turnos de evaluación</Badge>;
  return <Badge>Cerrado</Badge>;
}

export function EventCard({ event, role }: { event: EventDoc; role?: EventRole }) {
  return (
    <Link
      href={`/eventos/${event.id}`}
      className="group flex min-w-0 flex-col justify-between gap-6 rounded-3xl p-5 transition hover:-translate-y-0.5 ui-panel ui-interactive"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <EventStatus event={event} role={role ?? "student"} />
            {role && <Badge>{ROLE_LABEL[role]}</Badge>}
          </div>
          <ArrowUpRight className="size-5 shrink-0 opacity-40 transition group-hover:opacity-100" />
        </div>
        <h3 className="mt-4 break-words font-display text-xl font-bold leading-tight">{event.name}</h3>
        {event.institution && <p className="mt-1 font-mono text-[11px] text-muted">{event.institution}</p>}
      </div>
      {(event.startDate || event.endDate) && (
        <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
          <CalendarDays className="size-3.5" />
          {formatDate(event.startDate)}
          {event.endDate && event.endDate !== event.startDate && ` – ${formatDate(event.endDate)}`}
        </p>
      )}
    </Link>
  );
}
