"use client";

import { Plus, Trash2, UserRound } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import type { ProjectInfoInput } from "@/lib/data";
import type { Member, ProjectDoc } from "@/lib/types";
import { DEFAULT_CATEGORIES, displayEmail, isEmail, normalizeEmail } from "@/lib/utils";
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
  onSubmit: (input: ProjectInfoInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const formId = useId();
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const canAdd = members.length + 1 < maxTeamSize;

  function updateMember(index: number, patch: Partial<Member>) {
    setMembers((list) => list.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (title.trim().length < 3) errs.title = "Escribe el nombre del proyecto.";
    if (summary.trim().length < 20) errs.summary = "Describe el proyecto en al menos 20 caracteres.";
    if (problem.trim().length < 20) errs.problem = "Explica el problema (mínimo 20 caracteres).";
    if (solution.trim().length < 20) errs.solution = "Explica la solución (mínimo 20 caracteres).";
    if (canManageMembers && leaderName.trim().length < 3) errs.leaderName = "Escribe tu nombre completo (mínimo 3 caracteres).";
    const cleanMembers = members.filter((m) => m.name.trim() || m.email.trim());
    cleanMembers.forEach((m, i) => {
      if (!canManageMembers) return;
      if (m.name.trim().length < 3) errs[`m${i}`] = "Escribe el nombre del integrante";
      else if (!isEmail(m.email)) errs[`m${i}`] = "Correo inválido";
      else if (normalizeEmail(m.email) === leader.email) errs[`m${i}`] = "Ese correo ya es el tuyo";
      else if (cleanMembers.some((other, index) => index < i && normalizeEmail(other.email) === normalizeEmail(m.email))) errs[`m${i}`] = "Este correo ya está en el equipo";
    });
    if (cleanMembers.length + 1 > maxTeamSize) errs.members = `El evento admite hasta ${maxTeamSize} integrantes, incluido el líder.`;
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
        members: [{ ...leader, name: canManageMembers ? leaderName.trim() : leader.name }, ...cleanMembers.map((m) => ({ name: m.name.trim(), email: normalizeEmail(m.email) }))],
      });
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

      <Field label="Resumen" htmlFor={`${formId}-summary`} hint="Una o dos frases. Es lo primero que ven los jueces." error={errors.summary}>
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

      <div className="space-y-2">
        {canManageMembers && <Field label="Tu nombre completo (líder)" htmlFor={`${formId}-leader-name`} error={errors.leaderName}>
          <Input id={`${formId}-leader-name`} autoComplete="name" value={leaderName} maxLength={100} onChange={(e) => setLeaderName(e.target.value)} />
        </Field>}
        <p className="font-mono text-xs font-medium text-ink/80">
          Integrantes ({members.length + 1}/{maxTeamSize})
        </p>
        <div className="flex items-center gap-3 rounded-xl bg-paper px-3.5 py-3">
          <UserRound className="size-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{leaderName || "Tú"} · Líder</p>
            <p className="truncate font-mono text-[11px] text-muted">{displayEmail(leader.email)}</p>
          </div>
        </div>
        {!canManageMembers &&
          members.map((m) => (
            <div key={m.email} className="flex items-center gap-3 rounded-xl bg-paper px-3.5 py-3">
              <UserRound className="size-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name || "Integrante"}</p>
                <p className="truncate font-mono text-[11px] text-muted">{displayEmail(m.email)}</p>
              </div>
            </div>
          ))}
        {canManageMembers && members.map((m, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[1fr_1.3fr_auto]">
            <Input
              aria-label={`Nombre del integrante ${i + 2}`}
              placeholder="Nombre"
              value={m.name}
              onChange={(e) => updateMember(i, { name: e.target.value })}
            />
            <div>
              <Input
                aria-label={`Correo del integrante ${i + 2}`}
                placeholder="correo@escuela.mx"
                type="email"
                inputMode="email"
                value={m.email}
                onChange={(e) => updateMember(i, { email: e.target.value })}
              />
              {errors[`m${i}`] && <p className="mt-1 font-mono text-[11px] text-red-600">{errors[`m${i}`]}</p>}
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Quitar integrante"
              onClick={() => setMembers((list) => list.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {canManageMembers && canAdd && (
          <Button type="button" variant="outline" size="sm" onClick={() => setMembers((l) => [...l, { name: "", email: "" }])}>
            <Plus className="size-4" /> Agregar integrante
          </Button>
        )}
        <p className="font-mono text-[11px] text-muted">
          {canManageMembers
            ? "Cada integrante verá el proyecto al entrar con ese correo y podrá editar las entregas. Los jueces y organizadores del evento no pueden ser integrantes."
            : "Solo el líder del equipo puede agregar o quitar integrantes."}
        </p>
        {errors.members && <p role="alert" className="text-sm text-red-600">{errors.members}</p>}
      </div>

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
