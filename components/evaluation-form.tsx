"use client";

import { Lock, Minus, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Criterion, EvaluationDoc } from "@/lib/types";
import { weightedTotal } from "@/lib/utils";
import { Button, Field, Textarea } from "./ui";

const STEP = 0.5;

function clamp(v: number) {
  return Math.min(10, Math.max(0, Math.round(v / STEP) * STEP));
}

export function EvaluationForm({
  criteria,
  initial,
  locked,
  onSave,
}: {
  criteria: Criterion[];
  initial: EvaluationDoc | null;
  locked: boolean;
  onSave: (scores: Record<string, number>, total: number, comment: string) => Promise<void>;
}) {
  const [scores, setScores] = useState<Record<string, number>>(
    () => initial?.scores ?? Object.fromEntries(criteria.map((c) => [c.id, 5])),
  );
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const total = weightedTotal(criteria, scores);
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0) || 1;

  const set = (id: string, v: number) => setScores((s) => ({ ...s, [id]: clamp(v) }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(scores, total, comment);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {locked && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 font-mono text-[11px] text-amber-800">
          <Lock className="size-3.5 shrink-0" /> La evaluación está cerrada por el organizador. Puedes ver tu calificación
          pero no cambiarla.
        </p>
      )}

      <div className="space-y-4">
        {criteria.map((c) => {
          const value = scores[c.id] ?? 0;
          return (
            <div key={c.id} className="rounded-2xl bg-paper p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <label htmlFor={`score-${c.id}`} className="font-medium">
                    {c.name}
                  </label>
                  <p className="font-mono text-[11px] text-ink/55">
                    {c.description && `${c.description} · `}Peso {Math.round((c.weight / totalWeight) * 100)}%
                  </p>
                </div>
                <output htmlFor={`score-${c.id}`} className="font-display text-3xl font-bold tabular-nums">
                  {value}
                </output>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={locked || value <= 0}
                  onClick={() => set(c.id, value - STEP)}
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-ink transition hover:bg-ink/5 disabled:opacity-40"
                  aria-label={`Bajar ${c.name}`}
                >
                  <Minus className="size-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <input
                    id={`score-${c.id}`}
                    type="range"
                    min={0}
                    max={10}
                    step={STEP}
                    value={value}
                    disabled={locked}
                    onChange={(e) => set(c.id, Number(e.target.value))}
                    className="score-range w-full"
                    style={{ "--fill": `${value * 10}%` } as React.CSSProperties}
                  />
                  <div className="mt-1 flex justify-between font-mono text-[10px] text-ink/40" aria-hidden>
                    <span>0</span>
                    <span>5</span>
                    <span>10</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={locked || value >= 10}
                  onClick={() => set(c.id, value + STEP)}
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-ink transition hover:bg-ink/5 disabled:opacity-40"
                  aria-label={`Subir ${c.name}`}
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Field label="Comentarios para el equipo" htmlFor="comment" hint="Se muestran al equipo cuando se publiquen los resultados (sin tu nombre).">
        <Textarea id="comment" value={comment} disabled={locked} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      </Field>

      <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 rounded-2xl bg-night p-3 pl-4 text-white shadow-xl ring-1 ring-white/5 sm:pl-5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] text-white/60">Total ponderado</p>
          <p className="font-display text-2xl font-bold tabular-nums">
            {total.toFixed(1)} <span className="text-sm font-normal text-white/50">/100</span>
          </p>
        </div>
        <Button type="submit" loading={busy} disabled={locked}>
          {initial ? "Actualizar" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
