"use client";

import { useId, useState } from "react";
import { getCategoryCriteria } from "@/lib/event-config";
import type { Criterion } from "@/lib/types";
import { CriteriaEditor } from "./criteria-editor";
import { Button, Field } from "./ui";

const EMPTY_CRITERIA: Criterion[] = [{ id: "c_1", name: "", description: "", weight: 100 }];

export function CategoryCriteriaEditor({ categories, rubrics, fallbackCriteria, onChange, onSave, disabled }: {
  categories: string[];
  rubrics: Record<string, Criterion[]>;
  fallbackCriteria?: Criterion[];
  onChange: (category: string, criteria: Criterion[]) => void;
  onSave?: (category: string, criteria: Criterion[]) => Promise<void>;
  disabled?: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState(categories[0]);
  const [busy, setBusy] = useState(false);
  const category = categories.includes(selected) ? selected : categories[0];
  if (!category) return null;
  const customized = Object.hasOwn(rubrics, category);
  const criteria = getCategoryCriteria({ criteria: fallbackCriteria ?? EMPTY_CRITERIA, categoryCriteria: rubrics }, category);

  return (
    <div className="space-y-4">
      <Field label="Categoría de la rúbrica" htmlFor={id}>
        <select id={id} value={category} disabled={busy} onChange={(e) => setSelected(e.target.value)}
          className="h-11 w-full min-w-0 rounded-xl border-2 border-control bg-field px-3 text-base outline-none focus:border-ink sm:text-sm">
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </Field>
      <p className="font-mono text-xs leading-relaxed text-muted">
        Estos criterios se aplican únicamente a los proyectos de <strong>{category}</strong>.
        {fallbackCriteria && !customized && " Por ahora conserva la rúbrica general del evento. Al guardar tendrá su propia rúbrica."}
      </p>
      <fieldset disabled={disabled || busy}>
        <CriteriaEditor criteria={criteria} onChange={(next) => onChange(category, next)} />
      </fieldset>
      {onSave && <Button type="button" loading={busy} disabled={disabled} onClick={async () => {
        setBusy(true);
        try { await onSave(category, criteria); } finally { setBusy(false); }
      }}>Guardar rúbrica de {category}</Button>}
    </div>
  );
}
