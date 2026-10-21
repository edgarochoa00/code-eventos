/**
 * Compara dos proyectos y devuelve evidencia por tipo, no un solo porcentaje.
 * Lógica pura (sin Firebase): se prueba con detector/tests/logic.test.ts.
 */
import { signatureSimilarity } from "@/lib/similarity";
import { DETECTOR_POLICY } from "./policy";
import type { Comparable, Evidence, EvidenceLevel } from "./types";

type Policy = typeof DETECTOR_POLICY;

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function compareEvidence(
  a: Comparable,
  b: Comparable,
  aShingles: Iterable<number>,
  bShingles: Iterable<number>,
  excluded: Set<number>,
  policy: Policy = DETECTOR_POLICY,
): Evidence & { matched: number[] } {
  const th = policy.thresholds;

  // Enlaces: no cuentan los que cualquiera de los dos declaró como fuente de terceros
  const declared = new Set([...a.declaredUrls, ...b.declaredUrls]);
  const links = a.urls.filter((u) => b.urls.includes(u) && !declared.has(u)).length;
  const files = a.files.filter((f) => b.files.includes(f)).length;

  // Frases: comparación exacta de pares de palabras, sin bases del evento ni frases comunes
  const mine = new Set<number>();
  for (const h of aShingles) if (!excluded.has(h)) mine.add(h);
  const theirs = new Set<number>();
  for (const h of bShingles) if (!excluded.has(h)) theirs.add(h);
  const matched: number[] = [];
  for (const h of mine) if (theirs.has(h)) matched.push(h);
  const total = mine.size;
  const shared = matched.length;
  const containment = total ? shared / total : 0;

  const topic = signatureSimilarity(a.sigWords, b.sigWords);
  const continuation = a.members.some((m) => b.members.includes(m));

  const textHit = containment >= th.phraseContainment && shared >= th.minSharedShingles;
  let level: EvidenceLevel = "ninguna";
  if (files) level = "archivo";
  else if (links) level = "enlace";
  else if (textHit) level = "texto";
  else if (topic >= th.topic) level = "tema";

  const reasons: string[] = [];
  if (files) reasons.push(`${files} archivo(s) idéntico(s): es exactamente el mismo archivo.`);
  if (links) reasons.push(`${links} enlace(s) idéntico(s): mismo repositorio, video o documento.`);
  if (shared)
    reasons.push(
      `${pct(containment)} de las frases de este proyecto aparecen en el otro (${shared} de ${total} pares de palabras).`,
    );
  if (topic >= th.topic) reasons.push(`Vocabulario parecido (${pct(topic)}): tratan un tema similar. Por sí solo no indica copia.`);
  if (continuation) reasons.push("Comparten integrantes: puede ser la continuación del mismo equipo.");

  const strong = level === "archivo" || level === "enlace" || level === "texto";
  const alert = strong && !(continuation && policy.allowContinuation);

  return {
    level,
    alert,
    files,
    links,
    phrases: { shared, total, containment },
    topic,
    continuation,
    reasons,
    matched: matched.sort((x, y) => x - y),
  };
}

/** Filtro rápido (MinHash + hashes) para decidir si vale la pena la comparación exacta. */
export function isCandidate(a: Comparable, b: Comparable, policy: Policy = DETECTOR_POLICY) {
  if (a.files.some((f) => b.files.includes(f))) return true;
  if (a.urls.some((u) => b.urls.includes(u))) return true;
  const th = policy.thresholds;
  return (
    signatureSimilarity(a.sigPhrases, b.sigPhrases) >= th.candidatePhrases ||
    signatureSimilarity(a.sigWords, b.sigWords) >= th.candidateWords
  );
}

export const LEVEL_LABEL: Record<EvidenceLevel, string> = {
  archivo: "Archivo idéntico",
  enlace: "Mismo enlace",
  texto: "Frases en común",
  tema: "Tema parecido",
  ninguna: "Sin coincidencias",
};

/** Qué tan fuerte es cada tipo de evidencia, en palabras simples. */
export const LEVEL_HELP: Record<EvidenceLevel, string> = {
  archivo: "Prueba que es el mismo archivo. No prueba quién lo hizo: puede ser una plantilla o trabajo propio anterior.",
  enlace: "Prueba que vienen del mismo origen. Puede ser el mismo equipo continuando o un fork con permiso.",
  texto: "Indicio fuerte de texto copiado. Revisa las frases resaltadas antes de decidir.",
  tema: "Solo hablan de lo mismo. No se abre caso por esto.",
  ninguna: "No hay coincidencias relevantes.",
};
