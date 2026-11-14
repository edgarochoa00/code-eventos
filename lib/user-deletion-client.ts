import { auth } from "./firebase";
import {
  UserDeletionConflictError,
  type AuthUserSummary,
  type UserDeletionInspection,
  type UserDeletionResult,
} from "./user-deletion";

async function superadminHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para realizar esta operación.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${await user.getIdToken()}`,
  };
}

export async function listAdminAuthUsers(): Promise<AuthUserSummary[]> {
  const headers = await superadminHeaders();
  const response = await fetch("/api/admin/users", {
    method: "GET",
    headers: { Authorization: headers.Authorization },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las cuentas de Authentication.");
  return (data.users ?? []) as AuthUserSummary[];
}

export async function inspectUserDeletion(target: { email?: string; uid?: string }): Promise<UserDeletionInspection> {
  const response = await fetch("/api/admin/user-deletion", {
    method: "POST",
    headers: await superadminHeaders(),
    body: JSON.stringify({ action: "inspect", ...target }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "No se pudieron consultar los vínculos del usuario.");
  return data as UserDeletionInspection;
}

export async function executeUserDeletion(target: {
  email?: string;
  uid?: string;
  inspectionHash: string;
}): Promise<UserDeletionResult> {
  const response = await fetch("/api/admin/user-deletion", {
    method: "POST",
    headers: await superadminHeaders(),
    body: JSON.stringify({ action: "delete", ...target }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 409 && data.inspection) {
    throw new UserDeletionConflictError(
      data.error ?? "Los vínculos del usuario cambiaron. Revisa la lista actualizada antes de continuar.",
      data.inspection as UserDeletionInspection,
    );
  }
  if (!response.ok) throw new Error(data.error ?? "No se pudo eliminar el usuario. Intenta de nuevo.");
  return data as UserDeletionResult;
}
