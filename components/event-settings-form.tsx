"use client";

import { useState, type FormEvent } from "react";
import type { NewEventInput } from "@/lib/data";
import type { Phase } from "@/lib/types";
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 3) return setError("Escribe el nombre del evento.");
    if (!phases.prototype && !phases.final) return setError("Activa al menos una etapa: prototipo o producto final.");
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
