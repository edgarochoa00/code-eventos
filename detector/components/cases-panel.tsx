"use client";

import { ArrowUpRight, ScanSearch, ShieldCheck, Stamp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, EmptyState, ErrorNote, Modal, SectionTitle, Spinner, Tabs, firestoreErrorMessage, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useEventCases } from "@/lib/detector/hooks";
import { STATUS_LABEL } from "@/lib/detector/policy";
import { runDetection, sealEvent } from "@/lib/detector/store";
import type { CaseDoc, CaseStatus, DetectorProject } from "@/lib/detector/types";
import type { EventDoc } from "@/lib/types";
import { CaseView } from "./case-view";
import { CaseStatusBadge, EvidenceChips } from "./evidence-bits";

type Filter = "abiertos" | CaseStatus | "todos";
const OPEN: CaseStatus[] = ["por_revisar", "esperando_equipo", "en_revision", "propuesta"];

export function openCasesCount(cases: CaseDoc[]) {
  return cases.filter((c) => OPEN.includes(c.status)).length;
}

/** El caso más relevante de un proyecto, para mostrar una etiqueta en listas. */
export function projectCase(cases: CaseDoc[], projectId: string) {
  const order: CaseStatus[] = ["confirmado", "propuesta", "por_revisar", "en_revision", "esperando_equipo", "descartado"];
  return cases.filter((c) => c.projectId === projectId).sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))[0];
}

/** Pestaña «Originalidad» del organizador: analizar, sellar y revisar casos. */
export function CasesPanel({ event, projects }: { event: EventDoc; projects: DetectorProject[] }) {
  const { user } = useAuth();
  const toast = useToast();
  const cases = useEventCases(event.id, true);
  const [filter, setFilter] = useState<Filter>("abiertos");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<"analizar" | "sellar" | null>(null);

  const titles = useMemo(() => new Map(projects.map((p) => [p.id, p.title])), [projects]);
  const list = cases.data
    .filter((c) => (filter === "todos" ? true : filter === "abiertos" ? OPEN.includes(c.status) : c.status === filter))
    .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
  const current = cases.data.find((c) => c.id === selected) ?? null;
  const currentProject = current ? projects.find((p) => p.id === current.projectId) : undefined;

  async function analyze() {
    if (!user) return;
    setBusy("analizar");
    try {
      const r = await runDetection(event, projects, user, cases.data);
      toast(
        r.created || r.updated
          ? `${r.created} caso(s) nuevo(s), ${r.updated} actualizado(s).`
          : `Sin coincidencias nuevas. ${r.analyzed} proyecto(s) contra ${r.compared} del historial.`,
      );
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function seal() {
    if (!user) return;
    setBusy("sellar");
    try {
      const r = await sealEvent(event, projects, user);
      await runDetection(event, projects, user, cases.data);
      toast(`Sellados ${r.projects} proyecto(s). Ya cuentan como referencia para otros eventos.`);
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  const count = (s: CaseStatus) => cases.data.filter((c) => c.status === s).length;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Originalidad"
          subtitle="El detector no decide: guarda versiones con fecha, compara con todo el historial y abre un caso cuando algo coincide. Tú revisas la evidencia y decides."
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={analyze} loading={busy === "analizar"} disabled={!!busy || !projects.length}>
            <ScanSearch className="size-4" /> Analizar ahora
          </Button>
          <Button variant="outline" onClick={seal} loading={busy === "sellar"} disabled={!!busy || !projects.length}>
            <Stamp className="size-4" /> Sellar versión oficial
          </Button>
        </div>
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink/50">
          Sellar guarda la versión actual de cada proyecto como referencia oficial que los equipos no pueden modificar. Se hace
          solo al cerrar una etapa o publicar resultados; este botón lo hace ahora.
        </p>
      </Card>

      <Tabs<Filter>
        tabs={[
          { id: "abiertos", label: "Abiertos", count: openCasesCount(cases.data) },
          { id: "por_revisar", label: STATUS_LABEL.por_revisar, count: count("por_revisar") },
          { id: "propuesta", label: "Por confirmar", count: count("propuesta") },
          { id: "confirmado", label: STATUS_LABEL.confirmado, count: count("confirmado") },
          { id: "descartado", label: STATUS_LABEL.descartado, count: count("descartado") },
          { id: "todos", label: "Todos", count: cases.data.length },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {cases.error && <ErrorNote code={cases.error} />}

      {cases.loading ? (
        <Spinner />
      ) : list.length ? (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c.id)}
                className="flex w-full items-start gap-3 rounded-3xl bg-surface p-4 text-left transition hover:-translate-y-0.5 sm:p-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-display text-lg font-bold">{titles.get(c.projectId) ?? "Proyecto"}</span>
                    <CaseStatusBadge status={c.status} />
                  </span>
                  <span className="mt-1 block font-mono text-[11px] text-ink/55">
                    Coincide con un proyecto {c.otherEventId === event.id ? "de este evento" : `de ${c.otherYear}`} que apareció antes
                  </span>
                  <span className="mt-2 block">
                    <EvidenceChips evidence={c.evidence} />
                  </span>
                </span>
                <ArrowUpRight className="size-5 shrink-0 text-ink/40" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<ShieldCheck className="size-5" />}
          title={cases.data.length ? "Nada en esta lista" : "Sin casos"}
          text={
            cases.data.length
              ? "Cambia el filtro para ver otros casos."
              : "Toca «Analizar ahora» para comparar los proyectos con el historial. Si algo coincide, aparecerá aquí para que lo revises."
          }
        />
      )}

      <Modal open={!!current} onClose={() => setSelected(null)} title={currentProject?.title ?? "Caso"}>
        {current && currentProject && <CaseView event={event} project={currentProject} c={current} />}
        {current && !currentProject && <p className="font-mono text-xs text-ink/60">El proyecto ya no existe.</p>}
      </Modal>
    </div>
  );
}
