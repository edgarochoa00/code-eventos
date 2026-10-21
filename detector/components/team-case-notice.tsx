"use client";

import { MessageSquareWarning, Plus, Send, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, Card, Field, Input, Textarea, firestoreErrorMessage, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useProjectCases } from "@/lib/detector/hooks";
import { DETECTOR_POLICY, OUTCOME_LABEL } from "@/lib/detector/policy";
import { applyCaseAction } from "@/lib/detector/store";
import type { CaseDoc, DetectorProject } from "@/lib/detector/types";
import type { EventDoc } from "@/lib/types";
import { safeUrl } from "@/lib/utils";
import { HighlightedFields } from "./evidence-bits";

/**
 * Lo que ve el equipo: solo los casos que el organizador le notificó.
 * Nunca muestra el nombre ni el texto del otro proyecto.
 */
export function TeamCaseNotice({ event, project }: { event: EventDoc; project: DetectorProject }) {
  const cases = useProjectCases(event.id, project.id, "team");
  if (cases.loading || !cases.data.length) return null;
  return (
    <div className="space-y-4">
      {cases.data.map((c) => (
        <TeamCase key={c.id} event={event} project={project} c={c} />
      ))}
    </div>
  );
}

function TeamCase({ event, project, c }: { event: EventDoc; project: DetectorProject; c: CaseDoc }) {
  const { user } = useAuth();
  const toast = useToast();
  const [text, setText] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || text.trim().length < 20) return toast("Escribe tu explicación (mínimo 20 caracteres).", "error");
    setBusy(true);
    try {
      await applyCaseAction(event, c, user, {
        type: "responder",
        text,
        links: links.map(safeUrl).filter(Boolean),
      });
      toast("Explicación enviada. El organizador la revisará.");
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const where = c.otherEventId === event.id ? "en este mismo evento" : `en ${c.otherYear}`;

  return (
    <Card className="border border-amber-200">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
          <MessageSquareWarning className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold">
            {c.status === "confirmado"
              ? "Decisión sobre la originalidad de tu proyecto"
              : c.status === "descartado"
                ? "Revisión de originalidad cerrada"
                : "El organizador quiere tu explicación"}
          </h3>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink/65">
            {c.status === "confirmado" || c.status === "descartado"
              ? `Se revisaron las coincidencias entre tu proyecto y otro registrado antes ${where}, junto con tu explicación.`
              : `Encontramos coincidencias entre tu proyecto y otro registrado antes ${where}. Esto no significa que hayas copiado: puede ser una continuación, una plantilla o una coincidencia. Queremos escuchar tu versión.`}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-medium">Qué coincide</p>
        <ul className="font-mono text-[11px] leading-relaxed text-ink/75">
          {c.evidence.files > 0 && <li>• Uno o más archivos son idénticos a los de otro proyecto.</li>}
          {c.evidence.links > 0 && <li>• Uno o más enlaces (repositorio, video o documento) son los mismos.</li>}
          {c.evidence.phrases.shared > 0 && (
            <li>• {Math.round(c.evidence.phrases.containment * 100)}% de las frases de tu proyecto aparecen en el otro.</li>
          )}
        </ul>
        <HighlightedFields project={project} matched={c.matchedShingles} />
      </div>

      {c.status === "esperando_equipo" && DETECTOR_POLICY.teamCanRespond ? (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <Field
            label="Tu explicación"
            htmlFor={`resp-${c.id}`}
            hint="Por ejemplo: es la continuación de nuestro proyecto, usamos una plantilla, o cómo desarrollaron la idea."
          >
            <Textarea id={`resp-${c.id}`} rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} />
          </Field>
          <div className="space-y-2">
            <p className="font-mono text-xs font-medium text-ink/80">Pruebas (opcional)</p>
            <p className="font-mono text-[11px] text-ink/55">Historial de commits, bocetos, fotos del prototipo, documentos con fecha.</p>
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label={`Enlace de prueba ${i + 1}`}
                  inputMode="url"
                  placeholder="https://github.com/equipo/proyecto/commits"
                  value={l}
                  onChange={(e) => setLinks((ls) => ls.map((x, idx) => (idx === i ? e.target.value : x)))}
                />
                {links.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Quitar enlace"
                    onClick={() => setLinks((ls) => ls.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {links.length < 5 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setLinks((ls) => [...ls, ""])}>
                <Plus className="size-4" /> Agregar enlace
              </Button>
            )}
          </div>
          <Button type="submit" loading={busy}>
            <Send className="size-4" /> Enviar explicación
          </Button>
        </form>
      ) : c.teamResponse && c.status !== "confirmado" && c.status !== "descartado" ? (
        <p className="mt-5 rounded-2xl bg-paper p-3 font-mono text-[11px] text-ink/70">
          Enviaste tu explicación. El organizador la está revisando.
        </p>
      ) : null}

      {c.status === "confirmado" && c.decision && (
        <div className="mt-5 rounded-2xl bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">Resultado: {OUTCOME_LABEL[c.decision.outcome]}</p>
          <p className="mt-1 whitespace-pre-line font-mono text-[11px] text-red-700">{c.decision.reason}</p>
        </div>
      )}
      {c.status === "descartado" && (
        <p className="mt-5 rounded-2xl bg-emerald-50 p-4 font-mono text-[11px] text-emerald-800">
          El organizador revisó el caso y lo descartó. No afecta tu calificación.
        </p>
      )}
    </Card>
  );
}
