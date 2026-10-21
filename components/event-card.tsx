import { ArrowUpRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import type { EventDoc, EventRole } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "./ui";

const ROLE_LABEL: Record<EventRole, string> = { organizer: "Organizador", judge: "Juez", student: "Alumno" };

export function EventStatus({ event }: { event: EventDoc }) {
  if (event.resultsPublished) return <Badge tone="dark">Resultados publicados</Badge>;
  if (event.judgingOpen) return <Badge tone="lime">En evaluación</Badge>;
  if (event.submissions.prototype || event.submissions.final) return <Badge tone="green">Entregas abiertas</Badge>;
  if (event.registrationOpen) return <Badge tone="green">Registro abierto</Badge>;
  return <Badge>Cerrado</Badge>;
}

export function EventCard({ event, role, tone = "white" }: { event: EventDoc; role?: EventRole; tone?: "white" | "dark" }) {
  const dark = tone === "dark";
  return (
    <Link
      href={`/eventos/${event.id}`}
      className={`group flex flex-col justify-between gap-6 rounded-3xl p-5 transition hover:-translate-y-0.5 ${
        dark ? "bg-night text-white" : "bg-surface"
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <EventStatus event={event} />
            {role && <Badge tone={dark ? "lime" : "neutral"}>{ROLE_LABEL[role]}</Badge>}
          </div>
          <ArrowUpRight className="size-5 shrink-0 opacity-40 transition group-hover:opacity-100" />
        </div>
        <h3 className="mt-4 font-display text-xl font-bold leading-tight">{event.name}</h3>
        {event.institution && <p className={`mt-1 font-mono text-[11px] ${dark ? "text-white/60" : "text-ink/55"}`}>{event.institution}</p>}
      </div>
      {(event.startDate || event.endDate) && (
        <p className={`flex items-center gap-1.5 font-mono text-[11px] ${dark ? "text-white/60" : "text-ink/55"}`}>
          <CalendarDays className="size-3.5" />
          {formatDate(event.startDate)}
          {event.endDate && event.endDate !== event.startDate && ` – ${formatDate(event.endDate)}`}
        </p>
      )}
    </Link>
  );
}
