"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import type { Criterion } from "@/lib/types";
import { randomId } from "@/lib/utils";
import { Button, Field, Input } from "./ui";

export function CriteriaEditor({ criteria, onChange }: {
  criteria: Criterion[];
  onChange: (criteria: Criterion[]) => void;
}) {
  const prefix = useId();
  const total = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  function update(index: number, patch: Partial<Criterion>) {
    onChange(criteria.map((c, i) => i === index ? { ...c, ...patch } : c));
  }

  return (
    <div className="space-y-3">
      {criteria.map((c, i) => (
        <div key={c.id} className="grid gap-2 rounded-2xl bg-paper p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_90px_auto]">
          <Field label="Criterio" htmlFor={`${prefix}-${c.id}-name`}>
            <Input id={`${prefix}-${c.id}-name`} aria-label={`Nombre del criterio ${i + 1}`} placeholder="Nombre del criterio" value={c.name}
              onChange={(e) => update(i, { name: e.target.value })} className="bg-surface" />
          </Field>
          <Field label="Descripción" htmlFor={`${prefix}-${c.id}-description`}>
            <Input id={`${prefix}-${c.id}-description`} aria-label={`Descripción del criterio ${i + 1}`} placeholder="Qué se evaluará" value={c.description}
              onChange={(e) => update(i, { description: e.target.value })} className="bg-surface" />
          </Field>
          <Field label="Peso" htmlFor={`${prefix}-${c.id}-weight`}>
            <Input id={`${prefix}-${c.id}-weight`} aria-label={`Peso del criterio ${i + 1}`} type="number" min={0} max={100} step="any" value={c.weight}
              onChange={(e) => update(i, { weight: Number(e.target.value) })} className="bg-surface" />
          </Field>
          <Button type="button" variant="ghost" aria-label={`Quitar criterio ${i + 1}`} className="self-end justify-self-end"
            onClick={() => onChange(criteria.filter((_, index) => index !== i))} disabled={criteria.length <= 1}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" disabled={criteria.length >= 20}
          onClick={() => onChange([...criteria, { id: randomId("c"), name: "", description: "", weight: 10 }])}>
          <Plus className="size-4" /> Agregar criterio
        </Button>
        <span className="font-mono text-xs text-muted">
          Suma de pesos: {total}{total !== 100 && " (se normaliza a 100)"}
        </span>
      </div>
    </div>
  );
}
