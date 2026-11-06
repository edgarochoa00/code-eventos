export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function validateLogoFile(file: { size: number; type: string }) {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_LOGO_BYTES) {
    throw new Error("El logo debe pesar como máximo 2 MB y no estar vacío.");
  }
  if (!LOGO_TYPES.includes(file.type)) throw new Error("Elige un logo PNG, JPG o WebP.");
}

export function isProjectLogoPath(path: unknown, eventId: string, projectId: string): path is string {
  return typeof path === "string" && path.startsWith(`events/${eventId}/projects/${projectId}/logo/`)
    && /^[a-f0-9-]{36}\.webp$/.test(path.slice(path.lastIndexOf("/") + 1))
    && path.split("/").length === 6;
}
