import type { FileItem, Phase } from "./types";

export const MAX_FILE_MB = 30;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
export const MAX_SUBMISSION_FILES = 10;

export function validDocumentId(value: unknown): value is string {
  return typeof value === "string" && /^[\w-]{1,128}$/.test(value);
}

export function submissionFileLocation(path: unknown) {
  if (typeof path !== "string" || path.length > 512) return null;
  const match = /^events\/([\w-]{1,128})\/projects\/([\w-]{1,128})\/(prototype|final)\/([\w.-]+)$/.exec(path);
  if (!match || match[4] === "." || match[4] === "..") return null;
  return { eventId: match[1], projectId: match[2], phase: match[3] as Phase };
}

export function validateFileSize(size: number) {
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("El archivo está vacío o su tamaño no es válido.");
  if (size > MAX_FILE_BYTES) throw new Error(`El archivo supera ${MAX_FILE_MB} MB. Reduce su tamaño antes de subirlo.`);
}

export function isUploadedFile(file: FileItem) {
  return !!file.path && (file.storage === "supabase" || !!file.url);
}

export function validateSubmissionFiles(eventId: string, projectId: string, phase: Phase, files: FileItem[]) {
  if (!files.length || files.length > MAX_SUBMISSION_FILES) {
    throw new Error(`Agrega entre 1 y ${MAX_SUBMISSION_FILES} archivos a la entrega.`);
  }
  const seen = new Set<string>();
  for (const file of files) {
    const location = submissionFileLocation(file.path);
    if (file.storage !== "supabase" || !location || location.eventId !== eventId || location.projectId !== projectId || location.phase !== phase) {
      throw new Error(`Vuelve a subir ${file.name || "el archivo"} directamente a esta entrega.`);
    }
    validateFileSize(file.size);
    if (!/^[a-f0-9]{64}$/.test(file.sha256) || !file.name || file.name.length > 255 || file.type.length > 255 || seen.has(file.path!)) {
      throw new Error("Los datos de los archivos no son válidos. Vuelve a seleccionarlos.");
    }
    seen.add(file.path!);
  }
}
