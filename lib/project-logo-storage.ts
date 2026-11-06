"use client";

import { auth } from "./firebase";
import { validateLogoFile } from "./project-logo";

export async function projectLogoRequest(eventId: string, projectId: string, method = "GET", file?: File, cleanup = false, signal?: AbortSignal) {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para acceder al logo.");
  if (file) validateLogoFile(file);
  const token = await user.getIdToken();
  const body = file ? new FormData() : undefined;
  if (file) body!.set("file", file);
  const query = new URLSearchParams({ eventId, projectId, ...(cleanup ? { cleanup: "1" } : {}) });
  const response = await fetch(`/api/project-logo?${query}`, {
    method, headers: { Authorization: `Bearer ${token}` }, body, cache: "no-store", signal: signal ?? AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error || "No se pudo completar la operación con el logo.");
  }
  if (auth.currentUser?.uid !== user.uid) throw new Error("La sesión cambió. Vuelve a abrir el proyecto.");
  return response;
}
