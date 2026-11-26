"use client";

import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getPhaseLabel } from "@/lib/event-config";
import type { TeamResult } from "@/lib/results";
import { PHASES, type EventDoc } from "@/lib/types";
import { Button, Card, SectionTitle, Spinner } from "./ui";

type ResultState = { results: TeamResult[] } | { error: string };

export function TeamResults({ event, projectId, user }: { event: EventDoc; projectId: string; user: User }) {
  const [state, setState] = useState<ResultState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const eventId = event.id;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({ eventId, projectId });
        const response = await fetch(`/api/project-results?${params}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!controller.signal.aborted) setState(response.ok ? { results: payload.results } : { error: payload.error });
      } catch {
        if (!controller.signal.aborted) setState({ error: "No se pudieron cargar las calificaciones." });
      }
    }
    void load();
    return () => controller.abort();
  }, [eventId, projectId, user, attempt]);

  return (
    <Card>
      <SectionTitle title="Calificaciones del equipo" />
      {!state ? <Spinner label="Cargando calificaciones" /> : "error" in state ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-muted">{state.error}</p>
          <Button variant="outline" size="sm" onClick={() => { setState(null); setAttempt(attempt + 1); }}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {PHASES.filter((phase) => event.phases[phase]).map((phase) => {
            const result = state.results.find((item) => item.phase === phase);
            return (
              <section key={phase} className="ui-inset min-w-0 rounded-2xl p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="min-w-0 font-display text-lg font-bold wrap-anywhere">{getPhaseLabel(event, phase)}</h3>
                  {result && (
                    <div>
                      <p className="text-sm text-muted">Promedio</p>
                      <p className="font-display text-2xl font-bold tabular-nums">{result.score.toFixed(1)} <span className="text-sm font-medium text-muted">/ 100</span></p>
                    </div>
                  )}
                </div>
                {result ? (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold">Comentarios</h4>
                    {result.comments.length ? (
                      <ul className="mt-2 space-y-2">
                        {result.comments.map((comment, index) => (
                          <li key={index} className="rounded-xl bg-surface p-3 text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere">{comment}</li>
                        ))}
                      </ul>
                    ) : <p className="mt-2 text-sm text-muted">No hay comentarios para esta etapa.</p>}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">Para proteger el anonimato, el resumen se muestra a partir de dos evaluaciones de personas distintas.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}
