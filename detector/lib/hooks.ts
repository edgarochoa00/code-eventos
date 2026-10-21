"use client";

import { orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useCollection } from "@/lib/hooks";
import { anchorsCol, caseLogCol, casesCol, readEventName, readOtherProject } from "./store";
import type { AnchorDoc, CaseDoc, CaseLogDoc, DetectorProject } from "./types";

/** Todos los casos del evento (organizadores y admins). */
export function useEventCases(eventId: string, enabled: boolean) {
  return useCollection<CaseDoc>(enabled ? casesCol(eventId) : null, `cases:${eventId}:${enabled}`);
}

/**
 * Casos de un proyecto. El equipo solo puede consultar los que el organizador ya le notificó
 * (la consulta incluye teamNotified == true para cumplir las reglas).
 */
export function useProjectCases(eventId: string, projectId: string, mode: "staff" | "team" | null) {
  const q =
    mode === "staff"
      ? query(casesCol(eventId), where("projectId", "==", projectId))
      : mode === "team"
        ? query(casesCol(eventId), where("projectId", "==", projectId), where("teamNotified", "==", true))
        : null;
  return useCollection<CaseDoc>(q, `pcases:${eventId}:${projectId}:${mode}`);
}

export function useCaseLog(eventId: string, caseId: string) {
  return useCollection<CaseLogDoc>(query(caseLogCol(eventId, caseId), orderBy("at", "asc")), `clog:${eventId}:${caseId}`);
}

export function useAnchors(eventId: string, projectId: string, enabled = true) {
  return useCollection<AnchorDoc>(
    enabled ? query(anchorsCol(eventId, projectId), orderBy("createdAt", "asc")) : null,
    `anchors:${eventId}:${projectId}:${enabled}`,
  );
}

/** Nombre del otro evento (siempre visible) y el proyecto (solo si hay permiso). */
export function useOtherProject(eventId: string, projectId: string) {
  const key = `${eventId}/${projectId}`;
  const [state, setState] = useState<{ key: string; project: DetectorProject | null; eventName: string }>({
    key: "",
    project: null,
    eventName: "",
  });
  useEffect(() => {
    let alive = true;
    Promise.all([readOtherProject(eventId, projectId), readEventName(eventId)]).then(([project, eventName]) => {
      if (alive) setState({ key, project, eventName });
    });
    return () => {
      alive = false;
    };
  }, [eventId, projectId, key]);
  return { loading: state.key !== key, project: state.key === key ? state.project : null, eventName: state.eventName };
}
