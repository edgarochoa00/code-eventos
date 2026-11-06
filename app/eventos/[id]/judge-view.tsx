"use client";

import { ArrowUpRight, Info, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAgendaClock } from "@/components/judging-agenda";
import { Badge, EmptyState, ErrorNote, Input, SectionTitle, Spinner, Tabs } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { projectsCol, qMyEvaluations } from "@/lib/data";
import { useCollection } from "@/lib/hooks";
import { getCategoryCriteria, getPhaseLabel } from "@/lib/event-config";
import { judgeProgress, scheduleLabel } from "@/lib/judging-agenda";
import { PHASES, type EvaluationDoc, type EventDoc, type ProjectDoc } from "@/lib/types";
import {
  effectiveEvaluationTotal,
  hasJudgeAssignment,
  isProjectAssignedToJudge,
  normalizeEmail,
} from "@/lib/utils";

type Filter = "pending" | "assigned" | "all";

export function JudgeView({ event }: { event: EventDoc }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const email = normalizeEmail(user?.email ?? "");
  const allProjects = useCollection<ProjectDoc>(projectsCol(event.id), `projects:${event.id}`);
  // Un juez nunca ve para calificar un proyecto del que forma parte.
  const projects = { ...allProjects, data: allProjects.data.filter((p) => !p.registrationPending && !p.memberEmails?.includes(email)) };
  const mine = useCollection<EvaluationDoc>(qMyEvaluations(event.id, uid), `myevals:${event.id}:${uid}`);
  const now = useAgendaClock();
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");

  if (projects.loading || mine.loading) return <Spinner />;

  const phases = PHASES.filter((p) => event.phases[p]);
  const evaluated = (p: ProjectDoc, phase: (typeof phases)[number]) =>
    mine.data.find((e) => e.projectId === p.id && e.phase === phase);

  const hasCustom = hasJudgeAssignment(event, email) || projects.data.some(p => !!p.judging);
  const assignedProjects = projects.data.filter((p) => isProjectAssignedToJudge(event, p, email));

  const agenda = judgeProgress(event, projects.data, mine.data, email, now ?? 0);

  const q = search.trim().toLowerCase();
  const sourceProjects = filter === "all" ? projects.data : assignedProjects;
  const list = sourceProjects
    .filter((p) => !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    .filter((p) => filter !== "pending" || phases.some((ph) => !evaluated(p, ph)))
    .sort((a, b) => {
      const slots = event.judgeAssignments?.[email]?.schedule;
      const left = slots?.[a.id] ? Date.parse(slots[a.id].startsAt) : Infinity;
      const right = slots?.[b.id] ? Date.parse(slots[b.id].startsAt) : Infinity;
      return (left - right) || a.title.localeCompare(b.title);
    });

  const assignmentCategories = event.judgeAssignments?.[email]?.categories ?? [];

  return (
    <div className="space-y-6">
      {projects.error && <ErrorNote code={projects.error} />}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-3xl bg-night p-6 text-white">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-[11px] text-white/75">Tu avance</p>
              <p className="font-display text-4xl font-bold">
                {agenda.done}
                <span className="text-lg font-normal text-white/75">/{agenda.total}</span>
              </p>
            </div>
            <span className="font-mono text-sm text-lime">{agenda.percent}%</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${agenda.percent}%` }} />
          </div>
          {hasCustom && (
            <p className="mt-3 font-mono text-[11px] text-white/75">
              Asignado a {assignedProjects.length} proyecto(s)
              {assignmentCategories.length > 0 ? ` · ${assignmentCategories.join(", ")}` : ""}
            </p>
          )}
        </div>
        {(!event.judgingOpen || event.resultsPublished) && (
          <div className="flex max-w-sm items-start gap-3 rounded-3xl bg-amber-50 p-5 text-amber-900">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p className="font-mono text-[11px] leading-relaxed">
              {event.resultsPublished ? "Los resultados están publicados. Tus calificaciones ya no se pueden cambiar." : "La evaluación está cerrada. Puedes revisar los proyectos y calificar cuando el organizador la abra."}
            </p>
          </div>
        )}
      </div>

      {now !== null && <div className="rounded-2xl border border-line p-4 text-sm" role="status">
        Tu agenda · {agenda.due} evaluaciones en turno · {agenda.overdue} atrasadas pendientes. Horarios de Culiacán.
      </div>}
      <section>
        <SectionTitle title="Proyectos" subtitle="Toca un proyecto para revisarlo y calificarlo." />
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            tabs={[
              { id: "pending", label: "Pendientes", count: agenda.pending },
              ...(hasCustom ? [{ id: "assigned" as Filter, label: "Asignados", count: assignedProjects.length }] : []),
              { id: "all", label: "Todos", count: projects.data.length },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input aria-label="Buscar proyecto" placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-surface pl-9" />
          </div>
        </div>

        {list.length ? (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
            {list.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/eventos/${event.id}/proyectos/${p.id}`}
                  className="group flex h-full flex-col justify-between gap-4 ui-panel ui-interactive rounded-3xl p-5 transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-display text-lg font-bold leading-tight">{p.title}</h3>
                      <p className="line-clamp-2 font-mono text-[11px] text-muted">{p.summary}</p>
                    </div>
                    <ArrowUpRight className="size-5 shrink-0 opacity-40 group-hover:opacity-100" />
                  </div>
                  {now !== null && agenda.tasks.some(t=>t.project.id===p.id && !t.done && (t.status==='due' || t.status==='overdue')) && <Badge tone={agenda.tasks.some(t=>t.project.id===p.id && t.status==='overdue') ? 'red' : 'lime'}>{agenda.tasks.some(t=>t.project.id===p.id && t.status==='overdue') ? 'Turno vencido · pendiente' : 'Te toca calificar ahora'}</Badge>}
                  <p className="text-sm font-medium">{scheduleLabel(event.judgeAssignments?.[email]?.schedule?.[p.id])}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.category && <Badge>{p.category}</Badge>}
                    {!isProjectAssignedToJudge(event, p, email) && <Badge>Solo consulta</Badge>}
                    {phases.map((ph) => {
                      const ev = evaluated(p, ph);
                      if (!p[ph] && !ev) return <Badge key={ph}>{getPhaseLabel(event, ph)}: pendiente · presentación en vivo</Badge>;
                      return ev ? (
                        <Badge key={ph} tone="green">
                          {getPhaseLabel(event, ph)}: {effectiveEvaluationTotal(getCategoryCriteria(event, p.category), ev).toFixed(1)}
                        </Badge>
                      ) : (
                        <Badge key={ph} tone={isProjectAssignedToJudge(event, p, email) ? "lime" : "neutral"}>
                          {getPhaseLabel(event, ph)}: {isProjectAssignedToJudge(event, p, email) ? "por evaluar" : "sin asignación"}
                        </Badge>
                      );
                    })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={
              !projects.data.length
                ? "Aún no hay proyectos"
                : filter === "pending" && !agenda.total
                  ? "Sin tareas asignadas"
                  : filter === "pending"
                    ? "Nada pendiente"
                    : "Sin resultados"
            }
            text={
              !projects.data.length
                ? "Cuando los equipos se registren aparecerán aquí."
                : filter === "pending" && !agenda.total
                  ? "Aún no tienes proyectos o etapas por evaluar. Puedes consultar los proyectos en «Todos»."
                  : filter === "pending"
                    ? "Ya calificaste todas las entregas disponibles."
                    : "Prueba con otra búsqueda."
            }
          />
        )}
      </section>
    </div>
  );
}
