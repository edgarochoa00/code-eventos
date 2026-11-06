import assert from "node:assert/strict";
import { test } from "node:test";
import { projectJudgesError } from "../lib/project-judges";
import { isProjectAssignedToJudge } from "../lib/utils";
import { judgeProgress } from "../lib/judging-agenda";
import type { EventDoc, ProjectDoc } from "../lib/types";

const event = { judgeEmails: ["one@example.com", "two@example.com"], ownerEmail: "owner@example.com", organizerEmails: ["owner@example.com"],
  phases: { final: true, prototype: false }, judgeAssignments: { "one@example.com": { categories: ["Other"] } } } as unknown as EventDoc;
const project = { id: "p1", memberEmails: ["student@example.com"], category: "Software" } as ProjectDoc;

test("el organizador define máximos distintos y puede dejar proyectos pendientes de asignación", () => {
  assert.equal(projectJudgesError(event, project, { maxJudges: 1, judgeEmails: [] }), null);
  assert.equal(projectJudgesError(event, project, { maxJudges: 2, judgeEmails: event.judgeEmails }), null);
  for (const maxJudges of [0, -1, 1.5, NaN, Infinity]) assert.ok(projectJudgesError(event, project, { maxJudges, judgeEmails: [] }));
  assert.ok(projectJudgesError(event, project, { maxJudges: 1, judgeEmails: event.judgeEmails }));
});
test("rechaza duplicados, jueces retirados, conflictos, registro incompleto y resultados publicados", () => {
  for (const judgeEmails of [["one@example.com", "one@example.com"], ["retired@example.com"], ["student@example.com"], ["owner@example.com"]]) {
    assert.ok(projectJudgesError(event, project, { maxJudges: 3, judgeEmails }));
  }
  const judging = { maxJudges: 1, judgeEmails: ["one@example.com"] };
  assert.ok(projectJudgesError({ ...event, resultsPublished: true }, project, judging));
  assert.ok(projectJudgesError(event, { ...project, registrationPending: true }, judging));
});
test("la selección por proyecto manda sobre filtros, no permite acceso automático a nuevos jueces y actualiza estadísticas", () => {
  const selected = { ...project, judging: { maxJudges: 1, judgeEmails: ["one@example.com"] } };
  assert.equal(isProjectAssignedToJudge(event, selected, "one@example.com"), true);
  assert.equal(isProjectAssignedToJudge(event, selected, "two@example.com"), false);
  assert.equal(judgeProgress(event, [selected], [], "one@example.com", Date.now()).total, 1);
  assert.equal(judgeProgress(event, [selected], [], "two@example.com", Date.now()).total, 0);
  assert.equal(isProjectAssignedToJudge(event, { ...selected, judging: { maxJudges: 1, judgeEmails: [] } }, "two@example.com"), false);
  assert.equal(isProjectAssignedToJudge({ ...event, judgeEmails: [] }, selected, "one@example.com"), false);
  assert.equal(isProjectAssignedToJudge(event, { ...selected, memberEmails: ["one@example.com"] }, "one@example.com"), false);
  // Los proyectos anteriores conservan la asignación general hasta que el organizador los configure.
  assert.equal(isProjectAssignedToJudge(event, project, "two@example.com"), true);
});
