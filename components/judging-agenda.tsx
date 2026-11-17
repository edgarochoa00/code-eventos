"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { EvaluationDoc, EventDoc, JudgeAssignment, ProjectDoc } from "@/lib/types";
import { judgeProgress, scheduleBounds, scheduleLabel } from "@/lib/judging-agenda";
import { getPhaseLabel } from "@/lib/event-config";
import { Badge, Card, SectionTitle, Tabs } from "./ui";

const LABEL: Record<string, string> = { done: "Calificado", unscheduled: "Sin calificar · Sin horario", upcoming: "Sin calificar · Próximo", due: "Sin calificar · En turno", overdue: "Sin calificar · Atrasado" };
export function useAgendaClock(schedule?: JudgeAssignment["schedule"], enabled = true) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const boundaries = Object.values(schedule ?? {}).flatMap(slot => {
      const bounds = scheduleBounds(slot);
      return bounds ? [bounds.start, bounds.end] : [];
    });
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      const time = Date.now();
      setNow(time);
      const delay = boundaries.reduce((next, boundary) => boundary > time ? Math.min(next, boundary - time) : next, 30_000);
      timer = setTimeout(tick, delay);
    }
    tick();
    return () => clearTimeout(timer);
  }, [enabled, schedule]);
  return now;
}
export function JudgingControl({ event, projects, evaluations }: { event: EventDoc; projects: ProjectDoc[]; evaluations: EvaluationDoc[] }) {
  const now = useAgendaClock();
  const [filter, setFilter] = useState("all");
  if (now === null) return null;
  const rows = event.judgeEmails.map(email => judgeProgress(event, projects, evaluations, email, now));
  const done = rows.reduce((sum, row) => sum + row.done, 0), total = rows.reduce((sum, row) => sum + row.total, 0);
  return <Card className="lg:col-span-2">
    <SectionTitle title="Estadísticas de jueces" subtitle="Despliega un juez para ver qué proyectos tiene asignados, cuáles calificó y cuáles siguen pendientes. Horarios de Culiacán." />
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[['Calificadas', done], ['Pendientes', total - done], ['En turno', rows.reduce((s,r)=>s+r.due,0)], ['Atrasadas', rows.reduce((s,r)=>s+r.overdue,0)]].map(([label,value]) =>
        <div key={label} className="rounded-xl bg-paper p-3"><p className="text-xs text-muted">{label}</p><p className="text-2xl font-bold">{value}</p></div>)}
    </div>
    <Tabs value={filter} onChange={setFilter} tabs={[{id:'all',label:'Todos'},{id:'pending',label:'Con pendientes'},{id:'done',label:'Completaron'},{id:'overdue',label:'Atrasados'}]} />
    <p className="my-3 text-sm text-muted">{rows.filter(r=>r.total>0 && !r.pending).length} de {rows.length} jueces completaron su evaluación.</p>
    {!rows.length && <p className="py-4 text-sm text-muted">Agrega jueces en la pestaña Jueces para ver sus estadísticas.</p>}
    <div className="space-y-3">{rows.filter(r => filter === 'all' || (filter === 'pending' ? r.pending > 0 : filter === 'done' ? r.total > 0 && !r.pending : r.overdue > 0)).map(row =>
      <details key={row.email} className="rounded-2xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-medium wrap-anywhere">{row.email}
          <span className="mt-1 block text-xs text-muted">
            {new Set(row.tasks.map(task => task.project.id)).size} proyectos · {row.done}/{row.total} calificadas · {row.percent}%
            {" · "}{row.total ? `${row.pending} pendientes` : "Sin tareas asignadas"}
          </span>
        </summary>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper"><div className="h-full bg-ink" style={{width:`${row.percent}%`}} /></div>
        <ul className="mt-3 divide-y divide-line">{row.tasks.map(task => <li key={`${task.project.id}:${task.phase}`} className="py-3 text-sm">
          <Link className="font-medium underline underline-offset-2 wrap-anywhere" href={`/eventos/${event.id}/proyectos/${task.project.id}`}>{task.project.title}</Link>
          <p className="mt-1 text-xs text-muted wrap-anywhere">{getPhaseLabel(event, task.phase)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={task.done ? "green" : task.status === "overdue" ? "red" : "neutral"}>{LABEL[task.status]}</Badge>
            <p className="min-w-0 text-xs text-muted wrap-anywhere">{scheduleLabel(task.slot)}</p>
          </div>
        </li>)}</ul>
      </details>)}</div>
  </Card>;
}
