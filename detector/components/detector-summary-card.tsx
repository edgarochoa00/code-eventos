"use client";

import { AlertTriangle, ArrowUpRight, ScanSearch, ShieldCheck } from "lucide-react";
import { useEventCases } from "@/lib/detector/hooks";
import type { EventDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Tarjeta del resumen del organizador. Nunca afirma "sin plagio": solo cuenta casos. */
export function DetectorSummaryCard({ event, projectCount, onOpen }: { event: EventDoc; projectCount: number; onOpen: () => void }) {
  const cases = useEventCases(event.id, true);
  const open = cases.data.filter((c) => ["por_revisar", "esperando_equipo", "en_revision", "propuesta"].includes(c.status));
  const toReview = cases.data.filter((c) => c.status === "por_revisar" || c.status === "propuesta").length;

  let title = "Se activa con los primeros proyectos";
  let text = "Cuando los equipos registren sus proyectos, analiza el evento para compararlo con todo el historial.";
  if (cases.loading) {
    title = "Cargando…";
    text = "";
  } else if (open.length) {
    title = `${open.length} caso(s) abierto(s)`;
    text = toReview ? `${toReview} necesitan tu revisión.` : "Esperando respuesta de equipos o confirmación de un admin.";
  } else if (cases.data.length) {
    title = "Sin casos abiertos";
    text = `${cases.data.length} caso(s) ya revisado(s).`;
  } else if (projectCount) {
    title = "Sin casos";
    text = "Analiza el evento para comparar los proyectos con el historial.";
  }

  return (
    <button onClick={onOpen} className="flex w-full items-start gap-4 rounded-3xl bg-night p-5 text-left text-white">
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-2xl",
          toReview ? "bg-amber-400 text-coal" : open.length ? "bg-lime text-coal" : "bg-white/10 text-white",
        )}
      >
        {toReview ? <AlertTriangle className="size-5" /> : open.length ? <ShieldCheck className="size-5" /> : <ScanSearch className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] uppercase tracking-wider text-white/50">Originalidad</span>
        <span className="mt-0.5 block font-display font-bold">{title}</span>
        {text && <span className="mt-1 block font-mono text-[11px] leading-relaxed text-white/60">{text}</span>}
      </span>
      <ArrowUpRight className="size-5 shrink-0" />
    </button>
  );
}
