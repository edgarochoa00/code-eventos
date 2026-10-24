"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { NewEventInput } from "@/lib/data";
import type { Phase } from "@/lib/types";
import { DEFAULT_CATEGORIES } from "@/lib/utils";
import { Button, Field, Input, Textarea, Toggle } from "./ui";

export function EventSettingsForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<NewEventInput>;
  submitLabel: string;
  onSubmit: (input: NewEventInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [maxTeamSize, setMaxTeamSize] = useState(initial?.maxTeamSize ?? 5);
  const [phases, setPhases] = useState<Record<Phase, boolean>>(initial?.phases ?? { prototype: true, final: true });
  const [categories, setCategories] = useState<string[]>(
    initial?.categories?.length ? initial.categories : DEFAULT_CATEGORIES,
  );
  const [newCategory, setNewCategory] = useState("");
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
    if (!phases.prototype && !phases.final) return setError("Activa al menos una etapa: prototipo o producto final.");
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
        phases,
        categories,
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
        <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Expo Proyectos 2026" maxLength={100} />
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
      <div className="divide-y divide-ink/5 rounded-2xl bg-paper px-4">
        <Toggle
          label="Prototipo"
          description="Los equipos entregan un avance que se evalúa por separado."
          checked={phases.prototype}
          onChange={(v) => setPhases((p) => ({ ...p, prototype: v }))}
        />
        <Toggle
          label="Producto final"
          description="La entrega terminada. Puede convivir con el prototipo en el mismo proyecto."
          checked={phases.final}
          onChange={(v) => setPhases((p) => ({ ...p, final: v }))}
        />
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="ev-new-cat" className="font-mono text-xs font-medium text-ink/80">
            Categorías ({categories.length})
          </label>
          <button
            type="button"
            onClick={() => setCategories(DEFAULT_CATEGORIES)}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-ink/55 hover:text-ink"
          >
            <RotateCcw className="size-3" /> Predeterminadas
          </button>
        </div>
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
                  className="rounded-full p-0.5 text-ink/50 hover:bg-ink/10 hover:text-ink"
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
