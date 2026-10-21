/**
 * Orquestación de la detección (lógica pura, sin Firebase).
 *
 *  1. Exclusiones: bases del evento + frases que usan muchos equipos del mismo evento.
 *  2. Candidatos: filtro rápido contra el índice histórico y el resto del evento.
 *  3. Evidencia exacta solo para candidatos (los pares de palabras se cargan aparte).
 *  4. Prioridad: el caso se abre en el proyecto que apareció DESPUÉS. El anterior es la referencia.
 */
import { DETECTOR_POLICY } from "./policy";
import { compareEvidence, isCandidate } from "./evidence";
import { basesShingles } from "./signals";
import type { Alert, Comparable, IndexEntry, LiveProject } from "./types";

type Policy = typeof DETECTOR_POLICY;

export function toComparable(lp: LiveProject): Comparable {
  const { shingles: _s, contentHash: _c, ...rest } = lp.signals;
  void _s;
  void _c;
  return {
    ...rest,
    projectId: lp.project.id,
    eventId: lp.project.eventId,
    year: new Date(lp.firstSeenAt).getFullYear(),
    firstSeenAt: lp.firstSeenAt,
  };
}

/** Pares de palabras que no cuentan: bases del evento y frases que comparten muchos equipos. */
export function eventExclusions(eventTexts: string[], live: LiveProject[], policy: Policy = DETECTOR_POLICY) {
  const excluded = basesShingles(eventTexts);
  const th = policy.thresholds;
  if (live.length >= th.commonMinDocs) {
    const needed = Math.max(th.commonMinDocs, Math.ceil(th.commonRatio * live.length));
    const df = new Map<number, number>();
    for (const lp of live) for (const h of new Set(lp.signals.shingles)) df.set(h, (df.get(h) ?? 0) + 1);
    for (const [h, n] of df) if (n >= needed) excluded.add(h);
  }
  return excluded;
}

export type CandidatePair = { a: LiveProject; other: Comparable; otherLive: LiveProject | null };

/** Compara cada proyecto vivo contra el índice de otros eventos y contra el resto del evento. */
export function findCandidates(live: LiveProject[], index: IndexEntry[], currentEventId: string, policy: Policy = DETECTOR_POLICY) {
  const historical: Comparable[] = index.filter((e) => e.eventId !== currentEventId);
  const liveComparables = live.map((lp) => ({ lp, c: toComparable(lp) }));
  const pairs: CandidatePair[] = [];
  for (const { lp, c } of liveComparables) {
    for (const h of historical) if (h.projectId !== c.projectId && isCandidate(c, h, policy)) pairs.push({ a: lp, other: h, otherLive: null });
    for (const o of liveComparables) {
      if (o.c.projectId === c.projectId) continue;
      if (isCandidate(c, o.c, policy)) pairs.push({ a: lp, other: o.c, otherLive: o.lp });
    }
  }
  return pairs;
}

/** Proyectos del índice cuyos pares de palabras hay que cargar para la comparación exacta. */
export function shinglesToLoad(pairs: CandidatePair[]) {
  return Array.from(new Set(pairs.filter((p) => !p.otherLive).map((p) => p.other.projectId)));
}

/**
 * Evidencia exacta y decisión. Solo se alerta en el proyecto posterior:
 * el que apareció primero es la referencia y no carga con el caso.
 */
export function decideAlerts(
  pairs: CandidatePair[],
  shinglesByProject: Map<string, number[]>,
  excluded: Set<number>,
  policy: Policy = DETECTOR_POLICY,
): Alert[] {
  const alerts: Alert[] = [];
  for (const { a, other, otherLive } of pairs) {
    const later = a.firstSeenAt > other.firstSeenAt || (a.firstSeenAt === other.firstSeenAt && a.project.id > other.projectId);
    if (!later) continue;
    const otherShingles = otherLive ? otherLive.signals.shingles : shinglesByProject.get(other.projectId);
    if (!otherShingles) continue;
    const ev = compareEvidence(toComparable(a), other, a.signals.shingles, otherShingles, excluded, policy);
    if (!ev.alert) continue;
    const { matched, ...evidence } = ev;
    alerts.push({
      projectId: a.project.id,
      other,
      evidence,
      matchedShingles: matched.slice(0, 800),
      firstSeenAt: a.firstSeenAt,
    });
  }
  // La evidencia más fuerte primero
  const rank = { archivo: 0, enlace: 1, texto: 2, tema: 3, ninguna: 4 };
  return alerts.sort(
    (x, y) => rank[x.evidence.level] - rank[y.evidence.level] || y.evidence.phrases.containment - x.evidence.phrases.containment,
  );
}

export const caseIdFor = (projectId: string, otherProjectId: string) => `${projectId}__${otherProjectId}`;
