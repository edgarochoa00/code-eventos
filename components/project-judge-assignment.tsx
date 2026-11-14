"use client";

import { useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Toggle, firestoreErrorMessage, useToast } from "./ui";
import { saveProjectJudges } from "@/lib/data";
import { projectJudgesError } from "@/lib/project-judges";
import { displayEmail, isProjectAssignedToJudge } from "@/lib/utils";
import type { EventDoc, ProjectDoc } from "@/lib/types";

export function ProjectJudgeAssignments({ event, projects }: { event: EventDoc; projects: ProjectDoc[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const categories = [...new Set(projects.map(p => p.category))].sort();
  const visibleProjects = projects.filter(p => !category || p.category === category);
  const project = projects.find(p => p.id === editing);
  return <Card className="lg:col-span-2">
    <SectionTitle title="Asignación por proyecto" subtitle="Define el máximo y elige qué jueces califican cada proyecto. La selección guardada tiene prioridad sobre las asignaciones por categoría o por juez." />
    {!projects.length && <EmptyState title="Sin proyectos registrados" text="Los proyectos aparecerán aquí cuando los equipos completen su registro." />}
    <Field label="Filtrar proyectos por categoría" htmlFor="assignment-category">
      <select className="h-11 w-full rounded-xl border border-control bg-surface px-3 text-sm" id="assignment-category" value={category} onChange={e => setCategory(e.target.value)}>
        <option value="">Todas las categorías</option>
        {categories.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </Field>
    {!!projects.length && !visibleProjects.length && <p className="mt-4 text-sm text-muted">No hay proyectos en esta categoría.</p>}
    <ul className="divide-y divide-line">
      {visibleProjects.map(p => {
        const judges = event.judgeEmails.filter(email => isProjectAssignedToJudge(event, p, email));
        return <li key={p.id} className="space-y-3 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-medium">{p.title}</p>
              <p className="text-xs text-muted">{p.category}</p>
            </div>
            <Button variant="outline" size="sm" disabled={event.resultsPublished} onClick={() => setEditing(p.id)}>Configurar jueces</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={p.judging ? "lime" : undefined}>{p.judging ? `${judges.length} de ${p.judging.maxJudges} jueces` : `${judges.length} jueces · Máximo sin definir`}</Badge>
            {!judges.length && <span className="text-xs text-muted">Sin jueces asignados</span>}
            {judges.map(email => <Badge key={email}>{displayEmail(email)}</Badge>)}
          </div>
        </li>;
      })}
    </ul>
    {event.resultsPublished && <p className="mt-3 text-xs text-muted">Oculta los resultados para modificar las asignaciones.</p>}
    <Modal open={!!project} title="Jueces del proyecto" onClose={() => setEditing(null)}>
      {project && <ProjectJudgesEditor key={project.id} event={event} project={project} onClose={() => setEditing(null)} />}
    </Modal>
  </Card>;
}

function ProjectJudgesEditor({ event, project, onClose }: { event: EventDoc; project: ProjectDoc; onClose: () => void }) {
  const toast = useToast();
  const [maximum, setMaximum] = useState(project.judging ? String(project.judging.maxJudges) : "");
  const [selected, setSelected] = useState(event.judgeEmails.filter(email => isProjectAssignedToJudge(event, project, email)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const limit = Number(maximum);
  const error = projectJudgesError(event, project, { maxJudges: limit, judgeEmails: selected });
  return <form className="space-y-5" onSubmit={async e => {
    e.preventDefault();
    if (error) { setMessage(error); return; }
    setBusy(true);
    try {
      await saveProjectJudges(event.id, project.id, { maxJudges: limit, judgeEmails: selected });
      toast("Jueces del proyecto guardados.");
      onClose();
    } catch (err) { setMessage(firestoreErrorMessage(err)); }
    finally { setBusy(false); }
  }}>
    <p className="font-medium">{project.title}</p>
    <Field label="Máximo de jueces para este proyecto" htmlFor="project-judge-maximum">
      <Input id="project-judge-maximum" type="number" min="1" step="1" required value={maximum} onChange={e => { setMaximum(e.target.value); setMessage(""); }} placeholder="Elige el máximo" />
    </Field>
    <p className="text-sm">{selected.length} jueces seleccionados{Number.isSafeInteger(limit) && limit > 0 ? ` de ${limit} permitidos` : ""}</p>
    {limit > 0 && selected.length > limit && <p role="alert" className="text-sm text-red-700">Quita {selected.length - limit} juez(es) o aumenta el máximo antes de guardar.</p>}
    <div className="max-h-72 divide-y divide-line overflow-y-auto rounded-2xl bg-paper px-3">
      {event.judgeEmails.map(email => <Toggle key={email} label={displayEmail(email)} checked={selected.includes(email)}
        disabled={busy || project.memberEmails.includes(email) || (!selected.includes(email) && limit > 0 && selected.length >= limit)}
        onChange={() => { setSelected(prev => prev.includes(email) ? prev.filter(value => value !== email) : [...prev, email]); setMessage(""); }} />)}
    </div>
    {!event.judgeEmails.length && <p className="text-xs text-muted">Agrega jueces al evento para poder seleccionarlos.</p>}
    <p className="text-xs text-muted">Puedes guardar sin jueces y asignarlos después. Solo los seleccionados podrán calificar este proyecto. Los horarios se programan en «Agenda por juez». Las calificaciones ya guardadas se conservan al cambiar la selección.</p>
    {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
      <Button type="submit" loading={busy}>Guardar jueces</Button>
    </div>
  </form>;
}
