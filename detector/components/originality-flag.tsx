"use client";

import { ShieldAlert } from "lucide-react";
import { DETECTOR_POLICY, OUTCOME_LABEL } from "@/lib/detector/policy";
import type { DetectorProject } from "@/lib/detector/types";

/** Aviso para jueces y organizadores cuando un caso del proyecto se confirmó. */
export function OriginalityFlag({ project }: { project: DetectorProject }) {
  const s = project.originalityStatus;
  if (!s || s.status !== "confirmado" || !DETECTOR_POLICY.judgesSeeConfirmed) return null;
  return (
    <div className="flex items-start gap-3 rounded-3xl bg-red-50 p-4 text-red-700">
      <ShieldAlert className="mt-0.5 size-5 shrink-0" />
      <p className="font-mono text-[11px] leading-relaxed">
        Caso de originalidad confirmado
        {DETECTOR_POLICY.confirmation === "organizador+admin" ? " por el organizador y un admin" : " por el organizador"}:{" "}
        {OUTCOME_LABEL[s.outcome]}. Tómalo en cuenta al calificar.
      </p>
    </div>
  );
}
