import type { Timestamp } from "firebase/firestore";
import { DEFAULT_ORIGINALITY, type Criterion, type EventDoc, type EventRole, type OriginalitySettings } from "./types";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function initials(nameOrEmail: string) {
  return (
    nameOrEmail
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?"
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(value: string) {
  return EMAIL_RE.test(value.trim());
}

/** Separa una lista de correos escrita con comas, espacios o saltos de línea. */
export function parseEmails(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map(normalizeEmail)
        .filter(isEmail),
    ),
  );
}

export function randomCode(length = 6) {
  // Sin caracteres ambiguos (0/O, 1/I)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function randomId(prefix = "c") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDate(value: Timestamp | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : value.toDate();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Roles que tiene un usuario en un evento, en orden de prioridad.
 * Los admins globales administran cualquier evento aunque no estén en la lista de organizadores.
 */
export function rolesInEvent(event: EventDoc, email: string | null | undefined, isAdmin = false): EventRole[] {
  const me = normalizeEmail(email ?? "");
  const roles: EventRole[] = [];
  if (event.organizerEmails.includes(me)) roles.push("organizer");
  if (event.judgeEmails.includes(me)) roles.push("judge");
  if (isAdmin && !roles.includes("organizer")) roles.push("organizer");
  if (!roles.length) roles.push("student");
  return roles;
}

export function originalitySettings(event: EventDoc): OriginalitySettings {
  return { ...DEFAULT_ORIGINALITY, ...event.originality };
}

/** Hoy en formato AAAA-MM-DD (hora local). */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ¿Pueden los jueces ver el análisis de originalidad ahora? */
export function judgesSeeOriginality(event: EventDoc) {
  const o = originalitySettings(event);
  return o.judges === "always" || event.judgingOpen || event.resultsPublished;
}

/** ¿Puede un equipo ver el análisis de su propio proyecto ahora? */
export function teamsSeeOriginality(event: EventDoc) {
  const o = originalitySettings(event);
  if (o.teams === "results") return event.resultsPublished;
  if (o.teams === "date") return !!o.teamsFrom && todayISO() >= o.teamsFrom;
  return false;
}

/** Total ponderado 0–100 a partir de calificaciones 0–10 por criterio. */
export function weightedTotal(criteria: Criterion[], scores: Record<string, number>) {
  const totalWeight = criteria.reduce((sum, c) => sum + Math.max(0, c.weight), 0);
  if (!totalWeight) return 0;
  const raw = criteria.reduce((sum, c) => sum + ((scores[c.id] ?? 0) / 10) * Math.max(0, c.weight), 0);
  return Math.round((raw / totalWeight) * 1000) / 10;
}

export function safeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export const DEFAULT_CRITERIA: Criterion[] = [
  { id: "innovacion", name: "Innovación", description: "Qué tan original y novedosa es la propuesta.", weight: 25 },
  { id: "tecnica", name: "Viabilidad técnica", description: "Calidad de la solución y su implementación.", weight: 25 },
  { id: "impacto", name: "Impacto", description: "Beneficio real para usuarios o comunidad.", weight: 20 },
  { id: "funcionalidad", name: "Funcionalidad", description: "Qué tanto funciona lo que se presenta.", weight: 15 },
  { id: "presentacion", name: "Presentación", description: "Claridad del pitch y de la documentación.", weight: 15 },
];
