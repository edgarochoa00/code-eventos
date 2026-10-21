"use client";

import { ArrowUpRight, Info, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, EmptyState, ErrorNote, Input, SectionTitle, Spinner, Tabs } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { projectsCol, qMyEvaluations } from "@/lib/data";
import { useCollection } from "@/lib/hooks";
import { PHASE_LABEL, PHASES, type EvaluationDoc, type EventDoc, type ProjectDoc } from "@/lib/types";

type Filter = "pending" | "all";

export function JudgeView({ event }: { event: EventDoc }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const projects = useCollection<ProjectDoc>(projectsCol(event.id), `projects:${event.id}`);
  const mine = useCollection<EvaluationDoc>(qMyEvaluations(event.id, uid), `myevals:${event.id}:${uid}`);
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");

  if (projects.loading || mine.loading) return <Spinner />;

  const phases = PHASES.filter((p) => event.phases[p]);
  const evaluated = (p: ProjectDoc, phase: (typeof phases)[number]) =>
    mine.data.find((e) => e.projectId === p.id && e.phase === phase);
  // Una tarea = proyecto con entrega en esa etapa
  const tasks = projects.data.flatMap((p) => phases.filter((ph) => p[ph]).map((ph) => ({ p, ph })));
  const done = tasks.filter(({ p, ph }) => evaluated(p, ph)).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const q = search.trim().toLowerCase();
  const list = projects.data
    .filter((p) => !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    .filter((p) => filter === "all" || phases.some((ph) => p[ph] && !evaluated(p, ph)))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="space-y-6">
      {projects.error && <ErrorNote code={projects.error} />}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-3xl bg-night p-6 text-white">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-[11px] text-white/60">Tu avance</p>
              <p className="font-display text-4xl font-bold">
                {done}
                <span className="text-lg font-normal text-white/50">/{tasks.length}</span>
              </p>
            </div>
            <span className="font-mono text-sm text-lime">{pct}%</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {!event.judgingOpen && (
          <div className="flex max-w-sm items-start gap-3 rounded-3xl bg-amber-50 p-5 text-amber-900">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p className="font-mono text-[11px] leading-relaxed">
              La evaluación aún no está abierta. Puedes revisar los proyectos; podrás calificar cuando el organizador la
              abra.
            </p>
          </div>
        )}
      </div>

      <section>
        <SectionTitle title="Proyectos" subtitle="Toca un proyecto para revisarlo y calificarlo." />
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            tabs={[
              { id: "pending", label: "Pendientes", count: tasks.length - done },
              { id: "all", label: "Todos", count: projects.data.length },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
            <Input aria-label="Buscar proyecto" placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-surface pl-9" />
          </div>
        </div>

        {list.length ? (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
            {list.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/eventos/${event.id}/proyectos/${p.id}`}
                  className="group flex h-full flex-col justify-between gap-4 rounded-3xl bg-surface p-5 transition hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-bold">{p.title}</h3>
                      <p className="line-clamp-2 font-mono text-[11px] text-ink/55">{p.summary}</p>
                    </div>
                    <ArrowUpRight className="size-5 shrink-0 opacity-40 group-hover:opacity-100" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {phases.map((ph) => {
                      const ev = evaluated(p, ph);
                      if (!p[ph]) return <Badge key={ph}>{PHASE_LABEL[ph]}: sin entrega</Badge>;
                      return ev ? (
                        <Badge key={ph} tone="green">
                          {PHASE_LABEL[ph]}: {ev.total.toFixed(1)}
                        </Badge>
                      ) : (
                        <Badge key={ph} tone="lime">
                          {PHASE_LABEL[ph]}: por evaluar
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
                : filter === "pending" && !tasks.length
                  ? "Aún no hay entregas"
                  : filter === "pending"
                    ? "Nada pendiente"
                    : "Sin resultados"
            }
            text={
              !projects.data.length
                ? "Cuando los equipos se registren aparecerán aquí."
                : filter === "pending" && !tasks.length
                  ? "Los equipos todavía no suben su prototipo ni su producto final. Puedes revisar los proyectos en «Todos»."
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
