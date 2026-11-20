"use client";

import { useId, useState, type FormEvent } from "react";
import type { ProjectInfoInput } from "@/lib/data";
import type { Member, ProjectDoc } from "@/lib/types";
import { DEFAULT_CATEGORIES } from "@/lib/utils";
import { AdvisorsField, TeamFields, validateTeamFields } from "./project-team-fields";
import { Button, Field, Input, Textarea } from "./ui";

export const CATEGORIES = DEFAULT_CATEGORIES;

export function ProjectForm({
  initial,
  leader,
  maxTeamSize,
  categories = CATEGORIES,
  submitLabel,
  canManageMembers = true,
  categoryLocked = false,
  onSubmit,
  onCancel,
}: {
  initial?: ProjectDoc;
  leader: Member;
  maxTeamSize: number;
  categories?: string[];
  submitLabel: string;
  /** Solo el líder agrega o quita integrantes. */
  canManageMembers?: boolean;
  categoryLocked?: boolean;
  onSubmit: (input: ProjectInfoInput, original?: ProjectDoc) => Promise<void>;
  onCancel?: () => void;
}) {
  const formId = useId();
  const [original] = useState(initial);
  const availableCategories =
    initial?.category && !categories.includes(initial.category)
      ? [initial.category, ...categories]
      : categories.length
        ? categories
        : CATEGORIES;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [problem, setProblem] = useState(initial?.problem ?? "");
  const [solution, setSolution] = useState(initial?.solution ?? "");
  const [technologies, setTechnologies] = useState(initial?.technologies.join(", ") ?? "");
  const [category, setCategory] = useState(initial?.category || availableCategories[0]);
  const [leaderName, setLeaderName] = useState(leader.name);
  const [members, setMembers] = useState<Member[]>(
    initial ? initial.members.filter((m) => m.email !== leader.email) : [],
  );
  const [advisors, setAdvisors] = useState(initial?.advisors ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (title.trim().length < 3) errs.title = "Escribe el nombre del proyecto.";
    if (summary.trim().length < 20) errs.summary = "Describe el proyecto en al menos 20 caracteres.";
    if (problem.trim().length < 20) errs.problem = "Explica el problema (mínimo 20 caracteres).";
    if (solution.trim().length < 20) errs.solution = "Explica la solución (mínimo 20 caracteres).";
    const team = validateTeamFields(leader, leaderName, members, maxTeamSize, canManageMembers);
    Object.assign(errs, team.errors);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        summary: summary.trim(),
        problem: problem.trim(),
        solution: solution.trim(),
        technologies: technologies
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 15),
        category,
        members: team.members,
        ...(canManageMembers && { advisors: advisors.trim() }),
      }, original);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Nombre del proyecto" htmlFor={`${formId}-title`} error={errors.title}>
          <Input id={`${formId}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Categoría" htmlFor={`${formId}-category`} hint={categoryLocked ? "La categoría queda fija al comenzar la evaluación." : undefined}>
          <select
            id={`${formId}-category`}
            value={category}
            disabled={categoryLocked}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 w-full min-w-0 rounded-xl border-2 border-control bg-field px-3 text-base outline-none focus:border-ink sm:text-sm"
          >
            {availableCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Resumen" htmlFor={`${formId}-summary`} hint="Una o dos frases. Es lo primero que ven los evaluadores." error={errors.summary}>
        <Textarea id={`${formId}-summary`} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} />
      </Field>
      <Field label="Problema que resuelve" htmlFor={`${formId}-problem`} error={errors.problem}>
        <Textarea id={`${formId}-problem`} value={problem} onChange={(e) => setProblem(e.target.value)} maxLength={3000} />
      </Field>
      <Field label="Solución propuesta" htmlFor={`${formId}-solution`} error={errors.solution}>
        <Textarea id={`${formId}-solution`} value={solution} onChange={(e) => setSolution(e.target.value)} maxLength={5000} />
      </Field>
      <Field label="Tecnologías" htmlFor={`${formId}-tech`} hint="Separadas por comas. Ej: Arduino, React, Firebase">
        <Input id={`${formId}-tech`} value={technologies} onChange={(e) => setTechnologies(e.target.value)} />
      </Field>

      {canManageMembers && <AdvisorsField value={advisors} onChange={setAdvisors} />}
      <TeamFields leader={leader} leaderName={leaderName} onLeaderNameChange={setLeaderName}
        members={members} onMembersChange={setMembers} maxTeamSize={maxTeamSize}
        canManageMembers={canManageMembers} errors={errors} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
