"use client";

import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Card, Modal, SectionTitle, Spinner } from "@/components/ui";
import { useAnchors, useProjectCases } from "@/lib/detector/hooks";
import type { DetectorProject } from "@/lib/detector/types";
import type { EventDoc } from "@/lib/types";
import { CaseView } from "./case-view";
import { AnchorTimeline, CaseStatusBadge, EvidenceChips } from "./evidence-bits";

/** Pestaña «Originalidad» del proyecto para organizadores y admins. */
export function ProjectOriginality({ event, project }: { event: EventDoc; project: DetectorProject }) {
  const cases = useProjectCases(event.id, project.id, "staff");
  const anchors = useAnchors(event.id, project.id);
  const [selected, setSelected] = useState<string | null>(null);
  const current = cases.data.find((c) => c.id === selected) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Casos de originalidad" subtitle="Coincidencias con proyectos que aparecieron antes." />
        {cases.loading ? (
          <Spinner />
        ) : cases.data.length ? (
          <ul className="space-y-2">
            {cases.data.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className="flex w-full items-start gap-3 rounded-2xl bg-paper p-4 text-left"
                >
                  <span className="min-w-0 flex-1 space-y-2">
                    <CaseStatusBadge status={c.status} />
                    <EvidenceChips evidence={c.evidence} />
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-ink/40" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 rounded-2xl bg-paper p-4 font-mono text-xs text-ink/65">
            <ShieldCheck className="size-4 shrink-0" /> Sin casos abiertos para este proyecto. Se actualiza al analizar el evento.
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="Versiones guardadas"
          subtitle="Cada guardado queda con la hora del servidor y no se puede editar ni borrar. Es el ancla de este proyecto."
        />
        {anchors.loading ? <Spinner /> : <AnchorTimeline anchors={anchors.data} />}
      </Card>

      <Modal open={!!current} onClose={() => setSelected(null)} title="Caso de originalidad">
        {current && <CaseView event={event} project={project} c={current} />}
      </Modal>
    </div>
  );
}
