import assert from "node:assert/strict";
import { test } from "node:test";
import { judgeProgress, scheduleStatus } from "../lib/judging-agenda";
import { projectJudgeEmails, projectScheduleAssignments } from "../lib/project-judging-schedule";
import type { EventDoc, ProjectDoc } from "../lib/types";

const judges = ["one@example.com", "two@example.com", "three@example.com"];
const slot = { startsAt: "2026-11-18T17:00:00.000Z", endsAt: "2026-11-18T17:20:00.000Z" };
const later = { startsAt: slot.endsAt, endsAt: "2026-11-18T17:40:00.000Z" };
const project = { id: "p1", category: "Software", memberEmails: [], judging: { maxJudges: 3, judgeEmails: judges } } as unknown as ProjectDoc;
const event = { accessVersion: 1, resultsPublished: false, ownerEmail: "owner@example.com", organizerEmails: ["owner@example.com"],
  judgeEmails: [...judges, "other@example.com"], phases: { prototype: false, final: true }, judgeAssignments: {
    [judges[0]]: { categories: ["Software"], projectIds: ["legacy"], schedule: { p2: later } },
    "other@example.com": { projectIds: ["p9"], schedule: { p9: slot } },
  } } as unknown as EventDoc;

test("un turno se aplica a los tres jueces conservando otras asignaciones y sin mutar los datos", () => {
  const before = structuredClone(event);
  const next = projectScheduleAssignments(event, project, slot, judges);
  for (const email of judges) assert.deepEqual(next[email].schedule?.p1, slot);
  assert.deepEqual(next[judges[0]].categories, ["Software"]);
  assert.deepEqual(next[judges[0]].projectIds, ["legacy"]);
  assert.deepEqual(next[judges[0]].schedule?.p2, later);
  assert.deepEqual(next["other@example.com"], event.judgeAssignments!["other@example.com"]);
  assert.deepEqual(event, before);
});

test("las tres agendas reciben el turno y habilitan calificación solo durante el intervalo", () => {
  const updated = { ...event, judgeAssignments: projectScheduleAssignments(event, project, slot, judges) };
  const now = Date.parse(slot.startsAt);
  for (const email of judges) {
    const progress = judgeProgress(updated, [project], [], email, now);
    assert.equal(progress.total, 1); assert.equal(progress.due, 1);
    assert.deepEqual(progress.tasks[0].slot, slot);
    assert.equal(scheduleStatus(progress.tasks[0].slot, now - 1), "upcoming");
    assert.equal(scheduleStatus(progress.tasks[0].slot, Date.parse(slot.endsAt)), "overdue");
  }
});

test("un conflicto del último juez rechaza el grupo completo y nombra al juez", () => {
  const current = { ...event, judgeAssignments: { ...event.judgeAssignments, [judges[2]]: { schedule: { p3: slot } } } };
  const before = structuredClone(current);
  assert.throws(() => projectScheduleAssignments(current, project, slot, judges), /three@example.com.*se cruza/);
  assert.deepEqual(current, before);
});

test("acepta turnos consecutivos y detecta cruces parciales y turnos contenidos", () => {
  for (const [startsAt, endsAt] of [["16:50", "17:10"], ["17:10", "17:30"], ["16:00", "18:00"], ["17:05", "17:10"]]) {
    const conflict = { startsAt: `2026-11-18T${startsAt}:00.000Z`, endsAt: `2026-11-18T${endsAt}:00.000Z` };
    const current = { ...event, judgeAssignments: { [judges[1]]: { schedule: { other: conflict } } } };
    assert.throws(() => projectScheduleAssignments(current, project, slot, judges), /two@example.com.*se cruza/);
  }
  assert.doesNotThrow(() => projectScheduleAssignments(event, project, slot, judges));
});

test("reemplaza excepciones del mismo proyecto y puede volver a aplicar el turno", () => {
  const current = { ...event, judgeAssignments: { [judges[0]]: { schedule: { p1: later } }, [judges[1]]: { schedule: { p1: slot } } } };
  const next = projectScheduleAssignments(current, project, slot, judges);
  assert.deepEqual(next[judges[0]].schedule?.p1, slot);
  assert.deepEqual(projectScheduleAssignments({ ...current, judgeAssignments: next }, project, slot, judges), next);
});

test("quitar turno afecta solo ese proyecto y sus jueces actuales", () => {
  const scheduled = { ...event, judgeAssignments: projectScheduleAssignments(event, project, slot, judges) };
  const next = projectScheduleAssignments(scheduled, project, null, judges);
  for (const email of judges) assert.equal(next[email].schedule?.p1, undefined);
  assert.deepEqual(next[judges[0]].schedule?.p2, later);
  assert.deepEqual(next["other@example.com"], event.judgeAssignments!["other@example.com"]);
});

test("rechaza jueces retirados, agregados o cambios en la selección mientras se editaba", () => {
  assert.throws(() => projectScheduleAssignments({ ...event, judgeEmails: judges.slice(0, 2) }, project, slot, judges), /asignados cambiaron/);
  const expanded = { ...project, judging: { maxJudges: 4, judgeEmails: [...judges, "other@example.com"] } };
  assert.throws(() => projectScheduleAssignments(event, expanded, slot, judges), /asignados cambiaron/);
  assert.throws(() => projectScheduleAssignments(event, { ...project, judging: { maxJudges: 3, judgeEmails: [judges[0]] } }, slot, judges), /asignados cambiaron/);
});

test("bloquea proyectos sin jueces, registros pendientes, eventos antiguos y resultados publicados", () => {
  assert.throws(() => projectScheduleAssignments(event, { ...project, judging: { maxJudges: 3, judgeEmails: [] } }, slot, []), /Asigna evaluadores/);
  assert.throws(() => projectScheduleAssignments(event, { ...project, registrationPending: true }, slot, judges), /completar su registro/);
  for (const current of [{ ...event, resultsPublished: true }, { ...event, accessVersion: undefined }]) {
    for (const value of [slot, null]) assert.throws(() => projectScheduleAssignments(current, project, value, judges), /no se pueden cambiar/);
  }
});

test("rechaza fechas incompletas, inválidas, invertidas y de duración cero", () => {
  for (const value of [{ ...slot, startsAt: "" }, { ...slot, endsAt: "" }, { ...slot, startsAt: slot.endsAt },
    { startsAt: slot.endsAt, endsAt: slot.startsAt }, { ...slot, startsAt: "2026-02-30T12:00:00.000Z" }]) {
    assert.throws(() => projectScheduleAssignments(event, project, value, judges), /Captura el inicio y el fin/);
  }
});

test("respeta asignaciones anteriores por categoría y proyecto; un horario no asigna proyectos", () => {
  const legacy = { ...project, judging: undefined };
  const current = { ...event, judgeAssignments: {
    [judges[0]]: { categories: ["Software"] }, [judges[1]]: { projectIds: ["p1"] }, [judges[2]]: { schedule: { p1: slot } },
  } };
  assert.deepEqual(projectJudgeEmails(current, legacy), judges.slice(0, 2));
  const next = projectScheduleAssignments(current, legacy, slot, judges.slice(0, 2));
  assert.deepEqual(next[judges[0]].categories, ["Software"]);
  assert.deepEqual(next[judges[1]].projectIds, ["p1"]);
  assert.deepEqual(next[judges[2]], current.judgeAssignments[judges[2]]);
});

test("excluye integrantes y organizadores aunque estén en la selección guardada", () => {
  const current = { ...event, organizerEmails: [event.ownerEmail, judges[1]] };
  assert.deepEqual(projectJudgeEmails(current, { ...project, memberEmails: [judges[2]] }), [judges[0]]);
});
