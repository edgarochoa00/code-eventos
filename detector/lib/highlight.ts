/**
 * Resalta en el texto PROPIO las frases que coinciden con el otro proyecto,
 * usando solo los hashes guardados en el caso (nunca el texto ajeno).
 */
import { hash32, pairKey, tokensWithOffsets } from "./signals";

export type Segment = { text: string; match: boolean };

export function highlight(text: string, matched: Set<number>): Segment[] {
  if (!text) return [];
  const tokens = tokensWithOffsets(text);
  const ranges: [number, number][] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (matched.has(hash32(pairKey(tokens[i].t, tokens[i + 1].t)))) ranges.push([tokens[i].start, tokens[i + 1].end]);
  }
  if (!ranges.length) return [{ text, match: false }];

  // Une rangos que se tocan o están separados solo por espacios/puntuación
  ranges.sort((x, y) => x[0] - y[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && (r[0] <= last[1] || /^[\s,.;:()-]*$/.test(text.slice(last[1], r[0])))) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }

  const out: Segment[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ text: text.slice(pos, s), match: false });
    out.push({ text: text.slice(s, e), match: true });
    pos = e;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: false });
  return out;
}

/** Cuántos caracteres del texto quedaron resaltados (para mostrar "N% resaltado"). */
export function highlightedRatio(segments: Segment[]) {
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  const hit = segments.reduce((n, s) => n + (s.match ? s.text.length : 0), 0);
  return total ? hit / total : 0;
}
