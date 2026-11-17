"use client";

import { useState } from "react";
import { saveProjectJudgeSchedule } from "@/lib/data";
import { scheduleBounds, scheduleInputToIso, scheduleInputValue, scheduleLabel } from "@/lib/judging-agenda";
import { projectJudgeEmails, projectScheduleAssignments, type JudgingSlot } from "@/lib/project-judging-schedule";
import type { EventDoc, ProjectDoc } from "@/lib/types";
import { displayEmail } from "@/lib/utils";
import { Button, Field, Input, firestoreErrorMessage, useToast } from "./ui";

export function projectScheduleSummary(event: EventDoc, project: ProjectDoc) {
  const judges = projectJudgeEmails(event, project);
  const slots = judges.map(email => event.judgeAssignments?.[email]?.schedule?.[project.id]);
  const first = slots[0];
  const shared = first && scheduleBounds(first) && slots.every(slot =>
    slot && Date.parse(slot.startsAt) === Date.parse(first.startsAt) && Date.parse(slot.endsAt) === Date.parse(first.endsAt));
  return { judges, shared: shared ? first : undefined,
    label: shared ? scheduleLabel(first) : slots.some(slot => scheduleBounds(slot)) ? "Horarios distintos o pendientes por juez" : "Sin horario asignado" };
}

export function ProjectJudgingScheduleEditor({ event, project, onClose }: { event: EventDoc; project: ProjectDoc; onClose: () => void }) {
  const toast = useToast();
  const summary = projectScheduleSummary(event, project);
  // La lista que el organizador vio debe coincidir con la lista al guardar.
  const [judges] = useState(summary.judges);
  const [start, setStart] = useState(scheduleInputValue(summary.shared?.startsAt));
  const [end, setEnd] = useState(scheduleInputValue(summary.shared?.endsAt));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(remove = false) {
    setMessage("");
    const slot: JudgingSlot | null = remove ? null : { startsAt: scheduleInputToIso(start), endsAt: scheduleInputToIso(end) };
    try {
      projectScheduleAssignments(event, project, slot, judges);
      setBusy(true);
      await saveProjectJudgeSchedule(event.id, project.id, slot, judges);
      toast(remove ? `Turno retirado de ${judges.length} jueces.` : `Turno guardado para ${judges.length} jueces.`);
      onClose();
    } catch (err) { setMessage(firestoreErrorMessage(err)); }
    finally { setBusy(false); }
  }

  return <form className="space-y-5" onSubmit={e => { e.preventDefault(); void save(); }}>
    <p className="font-medium wrap-anywhere">{project.title}</p>
    <p className="text-sm text-muted">Captura una sola vez el turno en hora de Culiacán. Se aplicará a los {judges.length} jueces asignados a este proyecto y reemplazará sus horarios anteriores para este proyecto.</p>
    <fieldset disabled={busy || event.resultsPublished} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Inicio" htmlFor="project-turn-start">
        <Input id="project-turn-start" type="datetime-local" required value={start} onChange={e => { setStart(e.target.value); setMessage(""); }} />
      </Field>
      <Field label="Fin" htmlFor="project-turn-end">
        <Input id="project-turn-end" type="datetime-local" required value={end} onChange={e => { setEnd(e.target.value); setMessage(""); }} />
      </Field>
    </fieldset>
    <div className="rounded-2xl bg-paper p-3">
      <p className="mb-2 text-sm font-medium">Jueces que recibirán este turno</p>
      <ul className="space-y-3">
        {judges.map(email => <li key={email} className="min-w-0">
          <p className="text-xs font-medium wrap-anywhere">{displayEmail(email)}</p>
          <p className="text-xs text-muted wrap-anywhere">Actual: {scheduleLabel(event.judgeAssignments?.[email]?.schedule?.[project.id])}</p>
        </li>)}
      </ul>
    </div>
    <p className="text-xs text-muted">Cada juez podrá enviar su calificación durante el turno. Para una excepción, ajusta su horario en «Horarios de los jueces». Si agregas jueces después, vuelve a aplicar el turno para incluirlos.</p>
    {message && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{message}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
      <Button type="submit" loading={busy} disabled={event.resultsPublished || event.accessVersion !== 1 || !judges.length}>Aplicar a todos los jueces</Button>
    </div>
    {judges.some(email => event.judgeAssignments?.[email]?.schedule?.[project.id]) && <div className="space-y-2 border-t border-line pt-3">
      <p className="text-xs text-muted">Si retiras el turno, estos jueces no podrán enviar calificaciones hasta que programes otro.</p>
      <Button type="button" variant="outline" size="sm" disabled={busy || event.resultsPublished || event.accessVersion !== 1} onClick={() => void save(true)}>Quitar turno a todos</Button>
    </div>}
  </form>;
}
