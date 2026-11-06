import assert from "node:assert/strict";
import { test } from "node:test";
import { judgeProgress, scheduleError, scheduleLabel, scheduleInputValue, scheduleInputToIso } from "../lib/judging-agenda";
import type { EventDoc, ProjectDoc, EvaluationDoc } from "../lib/types";

const email = "judge@example.com";
const event = { judgeEmails: [email], ownerEmail: "owner@example.com", organizerEmails: ["owner@example.com"], phases: { final: true, prototype: false },
  judgeAssignments: { [email]: { projectIds: ["p1", "p2"], schedule: {
    p1: { startsAt: "2026-11-05T17:00:00Z", endsAt: "2026-11-05T17:30:00Z" },
    p2: { startsAt: "2026-11-05T17:30:00Z", endsAt: "2026-11-05T18:00:00Z" },
  } } } } as unknown as EventDoc;
const projects = ["p1", "p2", "unassigned"].map(id => ({ id, memberEmails: [], category: "Software", title: id, final: null } as unknown as ProjectDoc));
const now = Date.parse("2026-11-05T17:40:00Z");
test("el formulario y la agenda comparten hora de Culiacán al convertir UTC, medianoche y año", () => {
  for (const [local, iso] of [
    ["2026-11-06T09:00", "2026-11-06T16:00:00.000Z"],
    ["2026-12-31T23:45", "2027-01-01T06:45:00.000Z"],
    ["2026-11-06T00:00", "2026-11-06T07:00:00.000Z"],
    ["2024-02-29T12:00", "2024-02-29T19:00:00.000Z"],
  ]) {
    assert.equal(scheduleInputToIso(local), iso);
    assert.equal(scheduleInputValue(iso), local);
  }
  assert.match(scheduleLabel({ startsAt: scheduleInputToIso("2026-11-06T09:00"), endsAt: scheduleInputToIso("2026-11-06T09:30") }), /9:00/);
});
test("fechas vacías o inválidas no producen errores ni turnos normalizados a otra fecha", () => {
  for (const raw of ["", "no-fecha", "2026-02-30T12:00", "2026-13-01T10:00", "2026-11-06T25:00"]) assert.equal(scheduleInputToIso(raw), "");
  assert.equal(scheduleInputValue(), "");
  assert.equal(scheduleInputValue("invalid"), "");
});
test("cuenta presentaciones en vivo sin archivos y distingue turnos y atrasos", () => {
  const row = judgeProgress(event, projects, [], email, now);
  assert.equal(row.total, 2); assert.equal(row.pending, 2);
  assert.equal(row.overdue, 1); assert.equal(row.due, 1); assert.equal(row.percent, 0);
});
test("las notas ajenas, de etapas desactivadas o proyectos no asignados no inflan avance; deduplica notas", () => {
  const evaluation = { judgeEmail: email.toUpperCase(), projectId: "p1", phase: "final" } as EvaluationDoc;
  const rows = [evaluation, evaluation, { ...evaluation, judgeEmail: "other@example.com", projectId: "p2" },
    { ...evaluation, projectId: "unassigned" }, { ...evaluation, projectId: "p2", phase: "prototype" } as EvaluationDoc];
  const row = judgeProgress(event, projects, rows, email, now);
  assert.equal(row.done, 1); assert.equal(row.percent, 50); assert.equal(row.overdue, 0); assert.equal(row.pending, 1);
});
test("pendientes de registro y conflictos de equipo no generan tareas; sin tareas no cuenta como completado", () => {
  const row = judgeProgress(event, projects.map(p => ({ ...p, registrationPending: true })), [], email, now);
  assert.equal(row.total, 0); assert.equal(row.percent, 0);
  assert.equal(judgeProgress(event, projects.map(p=>({...p,memberEmails:[email]})), [], email, now).total, 0);
});
test("un horario sin categorías ni proyectos mantiene la asignación a todos", () => {
  const all = { ...event, judgeAssignments: { [email]: { schedule: event.judgeAssignments![email].schedule } } };
  const row = judgeProgress(all, projects, [], email, now);
  assert.equal(row.total, 3); assert.equal(row.tasks.find(t=>t.project.id==='unassigned')?.status, 'unscheduled');
});
test("respeta inicio y fin exactos y muestra hora de Culiacán", () => {
  assert.equal(judgeProgress(event, projects, [], email, Date.parse('2026-11-05T17:00:00Z')).tasks[0].status,'due');
  assert.equal(judgeProgress(event, projects, [], email, Date.parse('2026-11-05T17:30:00Z')).tasks[0].status,'overdue');
  assert.match(scheduleLabel(event.judgeAssignments![email].schedule!.p1), /10:00/);
  assert.equal(scheduleLabel(), 'Sin horario asignado');
});
test("rechaza turnos incompletos, invertidos y traslapados; acepta turnos consecutivos", () => {
  const slots = event.judgeAssignments![email].schedule!;
  assert.equal(scheduleError(slots), null);
  assert.ok(scheduleError({ p1: { startsAt: slots.p1.startsAt, endsAt: '' } }));
  assert.ok(scheduleError({ p1: { startsAt: slots.p1.endsAt, endsAt: slots.p1.startsAt } }));
  assert.ok(scheduleError({ ...slots, p2: { startsAt: slots.p1.startsAt, endsAt: slots.p2.endsAt } }));
});
