"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { EventSettingsInput } from "@/lib/data";
import { categoryCriteriaError, getPhaseDetails } from "@/lib/event-config";
import type { Criterion } from "@/lib/types";
import { DEFAULT_CATEGORIES } from "@/lib/utils";
import { CategoryCriteriaEditor } from "./category-criteria-editor";
import { Button, Field, Input, Textarea } from "./ui";

export function EventSettingsForm({
  initial,
  submitLabel,
  onSubmit,
  rubric,
}: {
  initial?: Partial<EventSettingsInput>;
  submitLabel: string;
  onSubmit: (input: EventSettingsInput) => Promise<void>;
  rubric?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [maxTeamSize, setMaxTeamSize] = useState(initial?.maxTeamSize ?? 5);
  const [categories, setCategories] = useState<string[]>(
    initial?.categories?.length ? initial.categories : initial ? DEFAULT_CATEGORIES : ["General"],
  );
  const [newCategory, setNewCategory] = useState("");
  const [categoryCriteria, setCategoryCriteria] = useState<Record<string, Criterion[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function addCategory() {
    const clean = newCategory.trim();
    if (!clean) return;
    if (categories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setNewCategory("");
      return;
    }
    if (categories.length >= 20) return setError("Máximo 20 categorías por evento.");
    setCategories((prev) => [...prev, clean]);
    setNewCategory("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 3) return setError("Escribe el nombre del evento.");
    const rubrics = Object.fromEntries(categories.map((category) => [category,
      Object.hasOwn(categoryCriteria, category) ? categoryCriteria[category] : [{ id: "c_1", name: "", description: "", weight: 100 }],
    ]));
    if (rubric) {
      const rubricError = categoryCriteriaError(rubrics);
      if (rubricError) return setError(rubricError);
    }
    if (!categories.length) return setError("El evento necesita al menos una categoría.");
    if (startDate && endDate && endDate < startDate) return setError("La fecha de cierre es antes de la de inicio.");
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        institution: institution.trim(),
        description: description.trim(),
        startDate,
        endDate,
        maxTeamSize: Math.min(15, Math.max(1, maxTeamSize)),
        phases: initial?.phases ?? { prototype: true, final: false },
        phaseDetails: initial ? {
          prototype: getPhaseDetails(initial, "prototype"),
          final: getPhaseDetails(initial, "final"),
        } : { prototype: { name: "Entrega", description: "" } },
        categories,
        ...(rubric ? { categoryCriteria: rubrics } : {}),
      });
    } catch {
      setError("No se pudo guardar. Revisa tu conexión o tus permisos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Nombre del evento" htmlFor="ev-name">
        <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Carteles o Prototipos" maxLength={100} />
      </Field>
      <Field label="Institución" htmlFor="ev-inst">
        <Input
          id="ev-inst"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="Instituto Tecnológico de Culiacán"
          maxLength={120}
        />
      </Field>
      <Field label="Descripción" htmlFor="ev-desc" hint="Bases, reglas o lo que los equipos deben saber.">
        <Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
        <Field label="Inicio" htmlFor="ev-start">
          <Input id="ev-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Cierre" htmlFor="ev-end">
          <Input id="ev-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="Máx. integrantes" htmlFor="ev-team">
          <Input
            id="ev-team"
            type="number"
            min={1}
            max={15}
            value={maxTeamSize}
            onChange={(e) => setMaxTeamSize(Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="ev-new-cat" className="font-mono text-xs font-medium text-ink/80">
            Categorías ({categories.length})
          </label>
          <button
            type="button"
            onClick={() => setCategories(DEFAULT_CATEGORIES)}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-muted hover:text-ink"
          >
            <RotateCcw className="size-3" /> Usar ejemplos
          </button>
        </div>
        <p className="font-mono text-xs text-muted">Define tus categorías o usa General si no necesitas dividir los proyectos.</p>
        <div className="flex flex-wrap gap-1.5 rounded-2xl bg-paper p-3">
          {categories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 font-mono text-xs"
            >
              {cat}
              {categories.length > 1 && (
                <button
                  type="button"
                  aria-label={`Quitar categoría ${cat}`}
                  onClick={() => setCategories((prev) => prev.filter((c) => c !== cat))}
                  className="rounded-full p-0.5 text-muted hover:bg-ink/10 hover:text-ink"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            id="ev-new-cat"
            placeholder="Agregar categoría (ej. Robótica)"
            value={newCategory}
            maxLength={40}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addCategory} disabled={!newCategory.trim()}>
            <Plus className="size-4" /> Agregar
          </Button>
        </div>
      </div>

      {rubric && (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-bold">Criterios por categoría</h2>
          <p className="font-mono text-xs leading-relaxed text-muted">
            Selecciona cada categoría y define sus criterios y pesos. Cada criterio se califica de 0 a 10 y el total se calcula sobre 100.
          </p>
          <CategoryCriteriaEditor categories={categories} rubrics={categoryCriteria}
            onChange={(category, criteria) => setCategoryCriteria((prev) => ({ ...prev, [category]: criteria }))} />
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy} className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}
