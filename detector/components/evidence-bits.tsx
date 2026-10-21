"use client";

import { AlertTriangle, Clock, FileCheck2, History, Link2, Quote, ShieldCheck, Users } from "lucide-react";
import { LEVEL_HELP, LEVEL_LABEL } from "@/lib/detector/evidence";
import { highlight } from "@/lib/detector/highlight";
import { STATUS_LABEL } from "@/lib/detector/policy";
import { FIELD_LABEL, projectFields, type FieldKey } from "@/lib/detector/signals";
import type { AnchorDoc, CaseDoc, CaseStatus, DetectorProject, Evidence } from "@/lib/detector/types";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<CaseStatus, "neutral" | "lime" | "dark" | "red" | "amber" | "green"> = {
  por_revisar: "amber",
  esperando_equipo: "neutral",
  en_revision: "lime",
  propuesta: "dark",
  descartado: "green",
  confirmado: "red",
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function EvidenceChips({ evidence }: { evidence: Evidence }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {evidence.files > 0 && (
        <Badge tone="red">
          <FileCheck2 className="size-3" /> Archivo idéntico
        </Badge>
      )}
      {evidence.links > 0 && (
        <Badge tone="red">
          <Link2 className="size-3" /> Mismo enlace
        </Badge>
      )}
      {evidence.phrases.shared > 0 && (
        <Badge tone={evidence.level === "texto" ? "amber" : "neutral"}>
          <Quote className="size-3" /> {Math.round(evidence.phrases.containment * 100)}% de frases
        </Badge>
      )}
      {evidence.level === "tema" && <Badge>Tema parecido</Badge>}
      {evidence.continuation && (
        <Badge tone="green">
          <Users className="size-3" /> Mismo equipo
        </Badge>
      )}
    </div>
  );
}

/** Explicación de qué prueba cada tipo de evidencia encontrada. */
export function EvidenceExplained({ evidence }: { evidence: Evidence }) {
  const kinds = [
    evidence.files > 0 && "archivo",
    evidence.links > 0 && "enlace",
    evidence.phrases.shared > 0 && evidence.level !== "tema" && "texto",
    evidence.level === "tema" && "tema",
  ].filter(Boolean) as (keyof typeof LEVEL_LABEL)[];
  return (
    <ul className="space-y-2">
      {kinds.map((k) => (
        <li key={k} className="rounded-2xl bg-paper p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="size-3.5 shrink-0" /> {LEVEL_LABEL[k]}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink/65">{LEVEL_HELP[k]}</p>
        </li>
      ))}
      {evidence.reasons.map((r) => (
        <li key={r} className="px-1 font-mono text-[11px] leading-relaxed text-ink/75">
          • {r}
        </li>
      ))}
    </ul>
  );
}

/** Texto del propio proyecto con las frases coincidentes resaltadas. */
export function HighlightedFields({ project, matched }: { project: DetectorProject; matched: number[] }) {
  const set = new Set(matched);
  const fields = projectFields(project);
  const shown = (Object.keys(fields) as FieldKey[])
    .map((k) => ({ k, segments: highlight(fields[k], set) }))
    .filter((f) => f.segments.some((s) => s.match));
  if (!shown.length) {
    return <p className="font-mono text-[11px] text-ink/55">No hay frases resaltadas: la coincidencia es por archivo o enlace.</p>;
  }
  return (
    <div className="space-y-3">
      {shown.map(({ k, segments }) => (
        <div key={k}>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink/45">{FIELD_LABEL[k]}</p>
          <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed">
            {segments.map((s, i) =>
              s.match ? (
                <mark key={i} className="rounded bg-lime px-0.5 text-coal">
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </p>
        </div>
      ))}
      <p className="font-mono text-[10px] text-ink/45">Resaltado en verde: frases que también aparecen en el otro proyecto.</p>
    </div>
  );
}

export function formatDateTime(ms: number | null | undefined) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Quién apareció primero. El anterior es la referencia. */
export function PriorityTimeline({ c, otherLabel }: { c: CaseDoc; otherLabel: string }) {
  const days = Math.round((c.firstSeenAt - c.otherFirstSeenAt) / 86_400_000);
  const gap = days >= 365 ? `${Math.floor(days / 365)} año(s)` : days >= 1 ? `${days} día(s)` : "menos de un día";
  return (
    <ol className="ml-1 space-y-3 border-l border-ink/15">
      <li className="relative pl-4">
        <span className="absolute -left-[5.5px] top-1.5 size-2.5 rounded-full bg-ink" aria-hidden />
        <p className="text-sm font-medium">{otherLabel}</p>
        <p className="font-mono text-[11px] text-ink/55">Apareció primero · {formatDateTime(c.otherFirstSeenAt)} · es la referencia</p>
      </li>
      <li className="relative pl-4">
        <span className="absolute -left-[5.5px] top-1.5 size-2.5 rounded-full bg-lime ring-2 ring-ink" aria-hidden />
        <p className="text-sm font-medium">Este proyecto</p>
        <p className="font-mono text-[11px] text-ink/55">
          Apareció {gap} después · {formatDateTime(c.firstSeenAt)}
        </p>
      </li>
    </ol>
  );
}

const KIND_LABEL: Record<AnchorDoc["kind"], string> = {
  registro: "Registro",
  edicion: "Edición de información",
  prototype: "Entrega de prototipo",
  final: "Entrega final",
  sello: "Sello del organizador",
};

/** Versiones inmutables del proyecto (anclas con hora del servidor). */
export function AnchorTimeline({ anchors }: { anchors: AnchorDoc[] }) {
  if (!anchors.length) {
    return (
      <p className="flex items-center gap-2 font-mono text-[11px] text-ink/55">
        <Clock className="size-3.5" /> Aún no hay versiones guardadas.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {anchors.map((a, i) => (
        <li key={a.id} className={cn("flex items-start gap-3 rounded-2xl p-3", a.kind === "sello" ? "bg-paper" : "")}>
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ink/5 font-mono text-[10px]">{i + 1}</span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
              {a.kind === "sello" ? <ShieldCheck className="size-3.5" /> : <History className="size-3.5" />}
              {KIND_LABEL[a.kind]}
            </span>
            <span className="block font-mono text-[10px] text-ink/50">
              {formatDateTime(a.createdAt?.toMillis?.() ?? null)} · {a.source === "organizador" ? "organizador" : "equipo"} ·{" "}
              {a.tokenCount} palabras · huella {a.contentHash.slice(0, 10)}…
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
