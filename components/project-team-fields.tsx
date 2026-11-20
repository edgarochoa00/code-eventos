"use client";

import { Plus, Trash2, UserRound } from "lucide-react";
import { useId } from "react";
import type { Member } from "@/lib/types";
import { displayEmail, isEmail, normalizeEmail } from "@/lib/utils";
import { Button, Field, Input, Textarea } from "./ui";

export function validateTeamFields(leader: Member, leaderName: string, members: Member[], maxTeamSize: number, canManageMembers = true) {
  const errors: Record<string, string> = {};
  const seen = new Set([normalizeEmail(leader.email)]);
  const cleanMembers = members.flatMap((member, index) => {
    const name = member.name.trim();
    const email = normalizeEmail(member.email);
    if (!name && !email) return [];
    if (canManageMembers) {
      if (name.length < 3) errors[`m${index}`] = "Escribe el nombre del integrante.";
      else if (!isEmail(email)) errors[`m${index}`] = "Correo inválido.";
      else if (seen.has(email)) errors[`m${index}`] = "Este correo ya está en el equipo.";
      seen.add(email);
    }
    return [{ name, email }];
  });
  if (canManageMembers && leaderName.trim().length < 3) errors.leaderName = "Escribe el nombre completo del líder (mínimo 3 caracteres).";
  if (cleanMembers.length + 1 > maxTeamSize) errors.members = `El evento admite hasta ${maxTeamSize} integrantes, incluido el líder.`;
  return {
    errors,
    members: [{ ...leader, name: canManageMembers ? leaderName.trim() : leader.name }, ...cleanMembers],
  };
}

export function AdvisorsField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <Field label="Asesores (opcional)" htmlFor={id} hint="Escribe un nombre por línea.">
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={3000} rows={2} />
    </Field>
  );
}

export function TeamFields({
  leader, leaderName, onLeaderNameChange, members, onMembersChange, maxTeamSize,
  errors, canManageMembers = true, leaderNameLabel = "Tu nombre completo (líder)",
}: {
  leader: Member;
  leaderName: string;
  onLeaderNameChange: (value: string) => void;
  members: Member[];
  onMembersChange: (value: Member[]) => void;
  maxTeamSize: number;
  errors: Record<string, string>;
  canManageMembers?: boolean;
  leaderNameLabel?: string;
}) {
  const formId = useId();
  const canAdd = members.length + 1 < maxTeamSize;

  function updateMember(index: number, patch: Partial<Member>) {
    onMembersChange(members.map((member, i) => i === index ? { ...member, ...patch } : member));
  }

  return (
    <div className="space-y-2">
      {canManageMembers && <Field label={leaderNameLabel} htmlFor={`${formId}-leader-name`} error={errors.leaderName}>
        <Input id={`${formId}-leader-name`} autoComplete="name" value={leaderName} maxLength={100} onChange={(e) => onLeaderNameChange(e.target.value)} />
      </Field>}
      <p className="font-mono text-xs font-medium text-ink/80">
        Integrantes ({members.length + 1}/{maxTeamSize})
      </p>
      <div className="flex items-center gap-3 rounded-xl bg-paper px-3.5 py-3">
        <UserRound className="size-4 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{leaderName || "Integrante"} · Líder</p>
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
        <div key={i} className="grid gap-2 rounded-xl border border-line p-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            aria-label={`Nombre del integrante ${i + 2}`}
            placeholder="Nombre"
            maxLength={100}
            className="sm:col-span-2"
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
            size="sm"
            className="justify-self-end self-start"
            aria-label="Quitar integrante"
            onClick={() => onMembersChange(members.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      {canManageMembers && canAdd && (
        <Button type="button" variant="outline" size="sm" onClick={() => onMembersChange([...members, { name: "", email: "" }])}>
          <Plus className="size-4" /> Agregar integrante
        </Button>
      )}
      <p className="font-mono text-[11px] text-muted">
        {canManageMembers
          ? "Cada integrante verá el proyecto al entrar con ese correo y podrá editar las entregas. Los evaluadores y organizadores del evento no pueden ser integrantes."
          : "El líder o el organizador pueden actualizar el equipo."}
      </p>
      {errors.members && <p role="alert" className="text-sm text-red-600">{errors.members}</p>}
    </div>
  );
}
