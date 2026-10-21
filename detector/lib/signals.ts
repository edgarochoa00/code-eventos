/**
 * Señales de un proyecto: pares de palabras, MinHash y hashes de enlaces, archivos e integrantes.
 * Reutiliza la normalización de lib/similarity.ts para que todo sea consistente.
 */
import { minhash, normalizeText, normalizeUrl, projectText, sha256Text, tokenize } from "@/lib/similarity";
import type { AnchorSignals, Declaration, DetectorProject } from "./types";

export type Token = { t: string; start: number; end: number };

const WORD = /[\p{L}\p{N}]+/gu;
const URL_IN_TEXT = /https?:\/\/[^\s)]+|(?:www\.|github\.com|gitlab\.com|drive\.google\.com|youtu\.be|youtube\.com)[^\s)]*/gi;

/** Tokens normalizados con su posición en el texto original (para resaltar). */
export function tokensWithOffsets(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD)) {
    const start = m.index ?? 0;
    for (const t of tokenize(m[0])) out.push({ t, start, end: start + m[0].length });
  }
  return out;
}

/** Hash de 32 bits (FNV-1a + mezcla). Suficiente para comparar conjuntos de pares de palabras. */
export function hash32(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export const pairKey = (a: string, b: string) => `${a} ${b}`;

/** Pares de palabras consecutivas de un texto (sin cruzar de un campo a otro). */
export function textShingles(text: string) {
  const tokens = tokensWithOffsets(text);
  const keys: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) keys.push(pairKey(tokens[i].t, tokens[i + 1].t));
  return { tokens, keys, hashes: keys.map(hash32) };
}

export type FieldKey = "title" | "summary" | "problem" | "solution" | "technologies" | "prototype" | "final";

export const FIELD_LABEL: Record<FieldKey, string> = {
  title: "Nombre",
  summary: "Resumen",
  problem: "Problema",
  solution: "Solución",
  technologies: "Tecnologías",
  prototype: "Entrega de prototipo",
  final: "Entrega final",
};

export function projectFields(p: DetectorProject): Record<FieldKey, string> {
  return {
    title: p.title ?? "",
    summary: p.summary ?? "",
    problem: p.problem ?? "",
    solution: p.solution ?? "",
    technologies: (p.technologies ?? []).join(", "),
    prototype: p.prototype?.description ?? "",
    final: p.final?.description ?? "",
  };
}

/** Enlaces y fuentes que el equipo declaró como de terceros. */
export function declaredLinks(declaration: Declaration | null | undefined) {
  if (!declaration) return [];
  const text = `${declaration.sources ?? ""}\n${declaration.continues ?? ""}`;
  return Array.from(new Set((text.match(URL_IN_TEXT) ?? []).map(normalizeUrl).filter(Boolean)));
}

const MAX_SHINGLES = 6000;

export async function buildSignals(project: DetectorProject): Promise<AnchorSignals> {
  const fields = projectFields(project);
  const keys = new Set<string>();
  const hashes = new Set<number>();
  const words = new Set<string>();
  let tokenCount = 0;
  for (const text of Object.values(fields)) {
    const s = textShingles(text);
    tokenCount += s.tokens.length;
    s.tokens.forEach((t) => words.add(t.t));
    s.keys.forEach((k) => keys.add(k));
    s.hashes.forEach((h) => hashes.add(h));
  }

  const links = [...(project.prototype?.links ?? []), ...(project.final?.links ?? [])];
  const urls = Array.from(new Set(links.map((l) => normalizeUrl(l.url)).filter(Boolean)));
  const files = [...(project.prototype?.files ?? []), ...(project.final?.files ?? [])];

  return {
    sigPhrases: minhash(keys),
    sigWords: minhash(words),
    tokenCount,
    shingles: Array.from(hashes).sort((a, b) => a - b).slice(0, MAX_SHINGLES),
    urls: await Promise.all(urls.map(sha256Text)),
    files: Array.from(new Set(files.map((f) => f.sha256).filter(Boolean))),
    members: await Promise.all(Array.from(new Set(project.memberEmails ?? [])).map((e) => sha256Text(e.trim().toLowerCase()))),
    declaredUrls: await Promise.all(declaredLinks(project.declaration).map(sha256Text)),
    contentHash: await sha256Text(normalizeText(projectText(project))),
  };
}

/** Pares de palabras de las bases del evento: nunca cuentan como coincidencia. */
export function basesShingles(texts: string[]) {
  const out = new Set<number>();
  for (const t of texts) textShingles(t).hashes.forEach((h) => out.add(h));
  return out;
}
