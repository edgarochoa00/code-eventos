"use client";

import { deleteObject, getBlob, ref } from "firebase/storage";
import { auth, storage } from "./firebase";
import { validateFileSize } from "./submission-files";
import type { FileItem, Phase } from "./types";

async function storageRequest<T>(operation: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para acceder a los archivos.");
  const token = await user.getIdToken();
  const response = await fetch("/api/submission-files", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(operation), signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo completar la operación con el archivo.");
  if (auth.currentUser?.uid !== user.uid) throw new Error("La sesión cambió. Vuelve a abrir el proyecto.");
  return result as T;
}

export async function uploadSubmissionFile(eventId: string, projectId: string, phase: Phase, file: File) {
  validateFileSize(file.size);
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para subir archivos.");
  const { path, signedUrl } = await storageRequest<{ path: string; signedUrl: string }>({
    action: "upload", eventId, projectId, phase, name: file.name, size: file.size,
  });
  // Los bytes van directamente a Storage y no atraviesan el límite de cuerpo de Vercel.
  const response = await fetch(signedUrl, {
    method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
    body: file, signal: AbortSignal.timeout(300000),
  });
  if (!response.ok) throw new Error("No se pudo subir el archivo. Revisa tu conexión, el tamaño y el espacio disponible.");
  if (auth.currentUser?.uid !== user.uid) throw new Error("La sesión cambió durante la subida. Vuelve a abrir el proyecto.");
  return { path, storage: "supabase" as const };
}

export async function verifySubmissionFiles(files: FileItem[]) {
  await Promise.all(files.map(file => storageRequest({ action: "verify", path: file.path, size: file.size })));
}

export async function removeSubmissionFile(file: FileItem, discard = false) {
  if (!file.path) return;
  if (file.storage === "supabase") {
    await storageRequest({ action: discard ? "discard" : "remove", path: file.path });
  } else {
    // Compatibilidad con archivos que se hubieran subido a Firebase antes de esta versión.
    await deleteObject(ref(storage, file.path));
  }
}

export async function downloadSubmissionFile(file: FileItem) {
  const user = auth.currentUser;
  if (!user || !file.path) throw new Error("El archivo no está disponible. Pide al equipo que lo vuelva a subir.");
  let blob: Blob;
  if (file.storage === "supabase") {
    const { signedUrl } = await storageRequest<{ signedUrl: string }>({ action: "download", path: file.path });
    const response = await fetch(signedUrl, { cache: "no-store", signal: AbortSignal.timeout(300000) });
    if (!response.ok) throw new Error("No se pudo descargar el archivo. Intenta de nuevo.");
    blob = await response.blob();
  } else {
    blob = await getBlob(ref(storage, file.path), file.size);
  }
  if (auth.currentUser?.uid !== user.uid) throw new Error("La sesión cambió durante la descarga.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
