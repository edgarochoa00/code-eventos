"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { EvaluationDoc, EventDoc, ProjectDoc } from "@/lib/types";
import { judgeProgress, scheduleLabel } from "@/lib/judging-agenda";
import { getPhaseLabel } from "@/lib/event-config";
import { Badge, Card, SectionTitle, Tabs } from "./ui";

const LABEL: Record<string, string> = { done: "Calificado", unscheduled: "Sin calificar · Sin horario", upcoming: "Sin calificar · Próximo", due: "Sin calificar · En turno", overdue: "Sin calificar · Atrasado" };
export function useAgendaClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick(); const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);
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
        <summary className="cursor-pointer break-all text-sm font-medium">{row.email} · {new Set(row.tasks.map(t=>t.project.id)).size} proyectos asignados · {row.done}/{row.total} calificadas · {row.percent}% · {row.total ? `${row.pending} pendientes` : 'Sin tareas asignadas'}</summary>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper"><div className="h-full bg-ink" style={{width:`${row.percent}%`}} /></div>
        <ul className="mt-3 divide-y divide-line">{row.tasks.map(task => <li key={`${task.project.id}:${task.phase}`} className="py-3 text-sm">
          <p><Link className="underline underline-offset-2" href={`/eventos/${event.id}/proyectos/${task.project.id}`}>{task.project.title}</Link> · {getPhaseLabel(event,task.phase)} <Badge tone={task.done ? 'green' : task.status === 'overdue' ? 'red' : 'neutral'}>{LABEL[task.status]}</Badge></p>
          <p className="mt-1 text-xs text-muted">{scheduleLabel(task.slot)}</p>
        </li>)}</ul>
      </details>)}</div>
  </Card>;
}
