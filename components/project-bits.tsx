"use client";

import { AlertTriangle, CheckCircle2, Circle, Clock, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { MIN_TOKENS, type AnalysisState, type SimilarityLevel, type SimilarityMatch } from "@/lib/similarity";
import { PHASE_LABEL, PHASES, type EventDoc, type ProjectDoc } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";

export function SubmissionBadges({ project, event }: { project: ProjectDoc; event?: EventDoc }) {
  const phases = PHASES.filter((p) => !event || event.phases[p]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {phases.map((phase) =>
        project[phase] ? (
          <Badge key={phase} tone="green">
            <CheckCircle2 className="size-3" /> {PHASE_LABEL[phase]}
          </Badge>
        ) : (
          <Badge key={phase}>
            <Circle className="size-3" /> {PHASE_LABEL[phase]}
          </Badge>
        ),
      )}
    </div>
  );
}

const LEVEL_STYLE: Record<SimilarityLevel, { tone: "red" | "amber" | "neutral" | "green"; label: string }> = {
  alto: { tone: "red", label: "Similitud alta" },
  medio: { tone: "amber", label: "Similitud media" },
  bajo: { tone: "neutral", label: "Similitud baja" },
  original: { tone: "green", label: "Original" },
};

export function SimilarityBadge({ match, state = "ready" }: { match: SimilarityMatch | undefined; state?: AnalysisState }) {
  // Sin información suficiente no se afirma que sea original
  if (state !== "ready") {
    return (
      <Badge>
        <Clock className="size-3" /> Sin datos aún
      </Badge>
    );
  }
  if (!match) {
    return (
      <Badge tone="green">
        <ShieldCheck className="size-3" /> Original
      </Badge>
    );
  }
  const style = LEVEL_STYLE[match.level];
  return (
    <Badge tone={style.tone}>
      {match.level === "alto" || match.level === "medio" ? <AlertTriangle className="size-3" /> : <ShieldCheck className="size-3" />}
      {Math.round(match.score * 100)}%
    </Badge>
  );
}

export function NotEnoughData({ state }: { state: AnalysisState }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-paper p-4">
      <Clock className="mt-0.5 size-5 shrink-0 text-ink/50" />
      <p className="font-mono text-xs leading-relaxed text-ink/70">
        {state === "empty"
          ? "Este proyecto todavía no tiene análisis. Se genera en cuanto el equipo guarda su información."
          : `Aún hay muy poca información para comparar con confianza (menos de ${MIN_TOKENS} palabras útiles y sin enlaces ni archivos). El análisis se actualiza solo cuando el equipo agrega su descripción y entregas.`}
      </p>
    </div>
  );
}

export function MatchList({
  matches,
  currentEventId,
  anonymous = false,
}: {
  matches: SimilarityMatch[];
  currentEventId: string;
  /** Para equipos: oculta nombres y enlaces de los otros proyectos */
  anonymous?: boolean;
}) {
  if (!matches.length) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4">
        <ShieldCheck className="size-5 shrink-0 text-emerald-700" />
        <p className="font-mono text-xs text-emerald-800">
          Sin coincidencias relevantes con ningún proyecto registrado (de este u otros eventos).
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {matches.map((m, i) => {
        const pct = Math.round(m.score * 100);
        const sameEvent = m.other.eventId === currentEventId;
        const title = anonymous ? `Proyecto ${i + 1}` : m.other.title || "Sin título";
        const where = sameEvent ? "Este mismo evento" : anonymous ? "Otro evento" : m.other.eventName;
        return (
          <li key={m.other.projectId} className="flex gap-3 rounded-2xl border border-ink/5 bg-paper p-3 sm:gap-4 sm:p-4">
            <div
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold sm:size-14",
                m.level === "alto" ? "bg-red-600 text-white" : m.level === "medio" ? "bg-amber-400 text-coal" : "bg-surface",
              )}
            >
              {pct}%
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words font-display font-bold">{title}</p>
                <Badge tone={LEVEL_STYLE[m.level].tone}>{LEVEL_STYLE[m.level].label}</Badge>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-ink/55">
                {where} · {m.other.year}
              </p>
              <ul className="mt-2 space-y-1">
                {m.reasons.map((r) => (
                  <li key={r} className="font-mono text-[11px] leading-relaxed text-ink/75">
                    • {r}
                  </li>
                ))}
              </ul>
              {sameEvent && !anonymous && (
                <Link
                  href={`/eventos/${m.other.eventId}/proyectos/${m.other.projectId}`}
                  className="mt-2 inline-flex min-h-8 items-center gap-1 font-mono text-[11px] underline"
                >
                  Ver proyecto <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
