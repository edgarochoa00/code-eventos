/**
 * Detección de similitud entre proyectos (anti-plagio).
 *
 * Cada proyecto genera una "huella" (fingerprint) que se guarda para siempre,
 * aunque pasen años. Al revisar un proyecto se compara contra todas las huellas
 * históricas usando cuatro señales:
 *
 *  1. Frases: MinHash sobre pares de palabras consecutivas. Detecta texto copiado
 *     aunque se cambie el nombre del proyecto o se reordenen párrafos.
 *  2. Vocabulario: MinHash sobre palabras sueltas. Detecta reescrituras ligeras.
 *  3. Enlaces: mismo repositorio, video, Drive, Figma, etc.
 *  4. Archivos: misma huella SHA-256 del archivo entregado (copia exacta).
 */
import type { FingerprintDoc, ProjectDoc } from "./types";

export const SIGNATURE_SIZE = 128;

const STOPWORDS = new Set(
  (
    "a al algo algun alguna algunas alguno algunos ante antes asi aun aunque bajo bien cada como con contra cual cuales " +
    "cuando de del desde donde dos el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estan estar " +
    "estas este esto estos fue fueron gran ha han hasta hay la las le les lo los mas me mediante mi mientras mismo muy " +
    "nada ni no nos nosotros nuestra nuestro nuestros nuestras o otra otras otro otros para pero poco por porque puede " +
    "pueden que quien se sea ser si sin sobre solo son su sus tal tambien tan tanto te tiene tienen todo todos tu un una " +
    "uno unos usar uso y ya " +
    "the and or of to in for on with by an is are be this that it as at from our we can will"
  ).split(" "),
);

export function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function stem(word: string) {
  if (word.length > 5 && word.endsWith("es") && !/[aeiou]es$/.test(word)) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string) {
  return normalizeText(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

function fnv1a(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mix(h: number) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Firma MinHash: aproxima la similitud de Jaccard entre conjuntos. */
export function minhash(items: Iterable<string>, size = SIGNATURE_SIZE) {
  const sig = new Array<number>(size).fill(0xffffffff);
  for (const item of items) {
    const h1 = fnv1a(item);
    const h2 = mix(h1 ^ 0x9e3779b9) | 1;
    for (let i = 0; i < size; i++) {
      const v = (h1 + Math.imul(i, h2)) >>> 0;
      if (v < sig[i]) sig[i] = v;
    }
  }
  return sig;
}

export function signatureSimilarity(a: number[], b: number[]) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let same = 0;
  let valid = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 0xffffffff && b[i] === 0xffffffff) continue;
    valid++;
    if (a[i] === b[i]) same++;
  }
  return valid ? same / valid : 0;
}

/** Normaliza enlaces para que variantes del mismo recurso coincidan. */
export function normalizeUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    let host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    let path = url.pathname.replace(/\/+$/, "").replace(/\.git$/, "");
    if (host === "youtu.be") {
      host = "youtube.com";
      path = `/watch/${path.slice(1)}`;
    } else if (host === "youtube.com" && url.searchParams.get("v")) {
      path = `/watch/${url.searchParams.get("v")}`;
    }
    if (host === "github.com" || host === "gitlab.com") {
      // Solo usuario/repositorio
      path = path.split("/").slice(0, 3).join("/").toLowerCase();
    }
    if (host.endsWith("google.com")) {
      path = path.replace(/\/(view|edit|preview)$/, "");
    }
    if (!path || path === "/") return ""; // Un dominio solo no es evidencia
    return `${host}${path}`;
  } catch {
    return "";
  }
}

export function projectText(project: Pick<ProjectDoc, "title" | "summary" | "problem" | "solution" | "technologies" | "prototype" | "final">) {
  return [
    project.title,
    project.summary,
    project.problem,
    project.solution,
    project.technologies.join(" "),
    project.prototype?.description ?? "",
    project.final?.description ?? "",
  ].join("\n");
}

export async function buildFingerprint(
  project: ProjectDoc,
  eventName: string,
): Promise<Omit<FingerprintDoc, "updatedAt">> {
  const tokens = tokenize(projectText(project));
  const pairs = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) pairs.add(`${tokens[i]} ${tokens[i + 1]}`);

  const links = [...(project.prototype?.links ?? []), ...(project.final?.links ?? [])];
  const files = [...(project.prototype?.files ?? []), ...(project.final?.files ?? [])];
  const normalized = Array.from(new Set(links.map((l) => normalizeUrl(l.url)).filter(Boolean)));

  return {
    projectId: project.id,
    eventId: project.eventId,
    eventName,
    title: project.title,
    year: (project.createdAt?.toDate() ?? new Date()).getFullYear(),
    sigPhrases: minhash(pairs),
    sigWords: minhash(new Set(tokens)),
    // Solo el hash: permite detectar el mismo repositorio sin revelar el enlace a nadie
    urls: await Promise.all(normalized.map(sha256Text)),
    fileHashes: Array.from(new Set(files.map((f) => f.sha256).filter(Boolean))),
    tokenCount: tokens.length,
  };
}

/** Palabras mínimas para que la comparación de texto sea confiable. */
export const MIN_TOKENS = 25;

/**
 * Estado del análisis de un proyecto:
 *   empty  sin huella (aún no se analiza)
 *   thin   muy poco texto y sin enlaces/archivos: el resultado no sería confiable
 *   ready  hay información suficiente para comparar
 */
export type AnalysisState = "empty" | "thin" | "ready";

export function analysisState(fp: FingerprintDoc | undefined): AnalysisState {
  if (!fp) return "empty";
  if (fp.tokenCount < MIN_TOKENS && !fp.urls.length && !fp.fileHashes.length) return "thin";
  return "ready";
}

export type SimilarityLevel = "alto" | "medio" | "bajo" | "original";

export type SimilarityMatch = {
  other: FingerprintDoc;
  score: number;
  phrases: number;
  words: number;
  sharedUrls: string[];
  sharedFiles: number;
  level: SimilarityLevel;
  reasons: string[];
};

export function levelFor(score: number): SimilarityLevel {
  if (score >= 0.75) return "alto";
  if (score >= 0.45) return "medio";
  if (score >= 0.25) return "bajo";
  return "original";
}

type Comparable = Pick<FingerprintDoc, "sigPhrases" | "sigWords" | "urls" | "fileHashes" | "tokenCount">;

export function compareFingerprints(a: Comparable, b: FingerprintDoc): SimilarityMatch {
  // Textos muy cortos generan coincidencias poco confiables
  const confidence = Math.min(1, Math.min(a.tokenCount, b.tokenCount) / MIN_TOKENS);
  const phrases = signatureSimilarity(a.sigPhrases, b.sigPhrases) * confidence;
  const words = signatureSimilarity(a.sigWords, b.sigWords) * confidence;
  const sharedUrls = a.urls.filter((u) => b.urls.includes(u));
  const sharedFiles = a.fileHashes.filter((h) => b.fileHashes.includes(h)).length;

  // El vocabulario compartido pesa más porque una reescritura conserva las palabras clave
  // aunque cambie las frases; proyectos sin relación rara vez pasan de 10%.
  let score = Math.max(phrases, Math.min(1, words * 1.3));
  const reasons: string[] = [];
  if (sharedFiles) {
    score = 1;
    reasons.push(`${sharedFiles} archivo(s) idéntico(s) a los entregados por este proyecto`);
  }
  if (sharedUrls.length) {
    score = Math.max(score, 0.95);
    reasons.push(`Usa ${sharedUrls.length} enlace(s) idéntico(s) (repositorio, video, documento…)`);
  }
  if (phrases >= 0.25) reasons.push(`${Math.round(phrases * 100)}% de frases en común`);
  if (words >= 0.3) reasons.push(`${Math.round(words * 100)}% de vocabulario en común`);

  return { other: b, score, phrases, words, sharedUrls, sharedFiles, level: levelFor(score), reasons };
}

/** Coincidencias de un proyecto contra todo el historial, de mayor a menor. */
export function findMatches(target: Comparable & { projectId: string }, all: FingerprintDoc[], min = 0.25) {
  return all
    .filter((fp) => fp.projectId !== target.projectId)
    .map((fp) => compareFingerprints(target, fp))
    .filter((m) => m.score >= min)
    .sort((x, y) => y.score - x.score);
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256File(file: File) {
  return toHex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
}

export async function sha256Text(text: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
