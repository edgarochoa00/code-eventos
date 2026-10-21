"use client";

import { Gavel, MessageSquareQuote, RotateCcw, Send, ShieldX, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Field, Spinner, Textarea, firestoreErrorMessage, useToast } from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { useCaseLog, useOtherProject } from "@/lib/detector/hooks";
import { DETECTOR_POLICY, OUTCOME_LABEL, STATUS_LABEL } from "@/lib/detector/policy";
import { applyCaseAction, type CaseAction } from "@/lib/detector/store";
import type { CaseDoc, CaseOutcome, DetectorProject } from "@/lib/detector/types";
import type { EventDoc } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import {
  CaseStatusBadge,
  EvidenceChips,
  EvidenceExplained,
  HighlightedFields,
  PriorityTimeline,
  formatDateTime,
} from "./evidence-bits";

const ACTION_LABEL: Record<string, string> = {
  detectado: "Coincidencia detectada",
  evidencia_actualizada: "Evidencia actualizada",
  equipo_notificado: "Se notificó al equipo",
  en_revision: "Marcado en revisión",
  respuesta_equipo: "Respuesta del equipo",
  descartado: "Descartado",
  propuesta: "Propuesta de confirmación",
  propuesta_rechazada: "Propuesta rechazada",
  confirmado: "Confirmado",
  reabierto: "Caso reabierto",
};

/** Vista completa de un caso para organizadores y admins. */
export function CaseView({ event, project, c }: { event: EventDoc; project: DetectorProject; c: CaseDoc }) {
  const { user } = useAuth();
  const access = useAccess();
  const toast = useToast();
  const other = useOtherProject(c.otherEventId, c.otherProjectId);
  const log = useCaseLog(event.id, c.id);
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<CaseOutcome>(DETECTOR_POLICY.outcomes[1] ?? "aviso_jueces");
  const [busy, setBusy] = useState<string | null>(null);

  const sameEvent = c.otherEventId === event.id;
  const otherLabel = other.project
    ? `«${other.project.title}» · ${other.eventName || "otro evento"} · ${c.otherYear}`
    : `Proyecto ${sameEvent ? "de este evento" : `de ${other.eventName || "otro evento"}`} · ${c.otherYear}`;

  const twoPeople = DETECTOR_POLICY.confirmation === "organizador+admin";
  const canConfirmProposal = c.status === "propuesta" && access.isAdmin && c.proposal?.by !== user?.uid;
  const decided = c.status === "descartado" || c.status === "confirmado";
  const needsReason = reason.trim().length >= 10;

  async function act(key: string, action: CaseAction, ok: string) {
    if (!user) return;
    setBusy(key);
    try {
      await applyCaseAction(event, c, user, action);
      toast(ok);
      setReason("");
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <CaseStatusBadge status={c.status} />
        <EvidenceChips evidence={c.evidence} />
      </div>

      <section className="space-y-2">
        <h3 className="font-display text-base font-bold">Quién apareció primero</h3>
        {other.loading ? <Spinner label="Cargando" /> : <PriorityTimeline c={c} otherLabel={otherLabel} />}
        {!other.project && !other.loading && (
          <p className="font-mono text-[10px] leading-relaxed text-ink/45">
            Solo los admins y los organizadores de ese evento pueden ver el proyecto completo. Aquí ves la evidencia sin el
            texto ajeno.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-base font-bold">Evidencia</h3>
        <EvidenceExplained evidence={c.evidence} />
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-base font-bold">Frases que coinciden</h3>
        <HighlightedFields project={project} matched={c.matchedShingles} />
      </section>

      {(project.declaration?.continues || project.declaration?.sources) && (
        <section className="space-y-1 rounded-2xl bg-paper p-4">
          <h3 className="text-sm font-medium">Lo que declaró el equipo al registrar</h3>
          {project.declaration?.continues && (
            <p className="font-mono text-[11px] text-ink/70">Continúa: {project.declaration.continues}</p>
          )}
          {project.declaration?.sources && (
            <p className="font-mono text-[11px] text-ink/70">Fuentes de terceros: {project.declaration.sources}</p>
          )}
        </section>
      )}

      {c.teamResponse && (
        <section className="space-y-2 rounded-2xl border border-ink/10 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <MessageSquareQuote className="size-4" /> Respuesta del equipo · {formatDate(c.teamResponse.at)}
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed">{c.teamResponse.text}</p>
          {c.teamResponse.links.length > 0 && (
            <ul className="space-y-1">
              {c.teamResponse.links.map((l) => (
                <li key={l}>
                  <a href={l} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-[11px] underline">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(c.proposal || c.decision) && (
        <section className="space-y-2 rounded-2xl bg-paper p-4">
          {c.proposal && (
            <p className="text-sm">
              <span className="font-medium">Propuesta:</span> {OUTCOME_LABEL[c.proposal.outcome]} · {c.proposal.byEmail}
              <span className="block font-mono text-[11px] text-ink/65">{c.proposal.reason}</span>
            </p>
          )}
          {c.decision && (
            <p className="text-sm">
              <span className="font-medium">Decisión ({STATUS_LABEL[c.status]}):</span> {OUTCOME_LABEL[c.decision.outcome]} ·{" "}
              {c.decision.byEmail}
              <span className="block font-mono text-[11px] text-ink/65">{c.decision.reason}</span>
            </p>
          )}
        </section>
      )}

      {/* Acciones */}
      <section className="space-y-3 rounded-2xl border border-ink/10 p-4">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold">
          <Gavel className="size-4" /> Decisión
        </h3>

        {c.status === "propuesta" && !canConfirmProposal && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 font-mono text-[11px] text-amber-800">
            Esperando que un admin distinto de quien propuso confirme o rechace.
          </p>
        )}

        {canConfirmProposal && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              loading={busy === "confirmar"}
              onClick={() => act("confirmar", { type: "confirmar" }, "Caso confirmado.")}
            >
              <ThumbsUp className="size-4" /> Confirmar
            </Button>
            <Button
              variant="outline"
              loading={busy === "rechazar"}
              onClick={() => act("rechazar", { type: "rechazar", note: "Propuesta rechazada por un admin." }, "Propuesta rechazada.")}
            >
              <ThumbsDown className="size-4" /> Rechazar propuesta
            </Button>
          </div>
        )}

        {!decided && c.status !== "propuesta" && (
          <>
            <Field
              label="Motivo (obligatorio para descartar o proponer)"
              htmlFor={`reason-${c.id}`}
              hint="Explica qué revisaste. Queda en el historial y el equipo lo verá cuando se decida: no escribas nombres de otros equipos ni proyectos."
            >
              <Textarea id={`reason-${c.id}`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={3000} />
            </Field>
            <div className="space-y-1.5">
              <label htmlFor={`outcome-${c.id}`} className="block font-mono text-xs font-medium text-ink/80">
                Consecuencia si se confirma
              </label>
              <select
                id={`outcome-${c.id}`}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as CaseOutcome)}
                className="h-11 w-full rounded-xl border border-ink/10 bg-paper px-3 text-sm outline-none focus:border-ink/40"
              >
                {DETECTOR_POLICY.outcomes.map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {DETECTOR_POLICY.teamCanRespond && c.status !== "esperando_equipo" && (
                <Button
                  variant="dark"
                  loading={busy === "notificar"}
                  onClick={() => act("notificar", { type: "notificar" }, "Se pidió al equipo su explicación.")}
                >
                  <Send className="size-4" /> {c.teamNotified ? "Pedir más información" : "Pedir explicación al equipo"}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={!needsReason}
                loading={busy === "descartar"}
                onClick={() => act("descartar", { type: "descartar", reason }, "Caso descartado.")}
              >
                <ShieldX className="size-4" /> Descartar
              </Button>
              <Button
                variant="danger"
                disabled={!needsReason}
                loading={busy === "proponer"}
                onClick={() =>
                  act("proponer", { type: "proponer", outcome, reason }, twoPeople ? "Propuesta enviada a un admin." : "Caso confirmado.")
                }
              >
                <ThumbsUp className="size-4" /> {twoPeople ? "Proponer confirmación" : "Confirmar"}
              </Button>
            </div>
            {twoPeople && (
              <p className="font-mono text-[10px] text-ink/45">
                Para confirmar se necesitan dos personas: tú propones y un admin distinto confirma.
              </p>
            )}
          </>
        )}

        {decided && access.isAdmin && (
          <Button
            variant="outline"
            loading={busy === "reabrir"}
            onClick={() => act("reabrir", { type: "reabrir", note: "Reabierto por un admin." }, "Caso reabierto.")}
          >
            <RotateCcw className="size-4" /> Reabrir caso
          </Button>
        )}
        {decided && !access.isAdmin && (
          <p className="font-mono text-[11px] text-ink/55">Caso cerrado. Solo un admin puede reabrirlo.</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-base font-bold">Historial</h3>
        {log.loading ? (
          <Spinner />
        ) : (
          <ol className="space-y-2">
            {log.data.map((l) => (
              <li key={l.id} className={cn("rounded-2xl p-3", l.action === "confirmado" ? "bg-red-50" : "bg-paper")}>
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {ACTION_LABEL[l.action] ?? l.action}
                  <Badge>{formatDateTime(l.at?.toMillis?.() ?? null)}</Badge>
                </p>
                <p className="font-mono text-[10px] text-ink/50">{l.byEmail}</p>
                {l.note && <p className="mt-1 whitespace-pre-line font-mono text-[11px] leading-relaxed text-ink/70">{l.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
