import type { AccountInvitation, InvitationResult, InvitationScope } from "./account-invitations";
import { SavedInvitationError } from "./account-invitations";
import { auth } from "./firebase";

export async function sendAccountInvitation(scope: InvitationScope, email: string): Promise<InvitationResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para enviar el acceso.");
  const response = await fetch("/api/account-invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ ...scope, email } satisfies AccountInvitation),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el acceso. Intenta de nuevo.");
  return result;
}

export async function sendInvitations(scope: InvitationScope, emails: string[]) {
  const failed: string[] = [];
  // Limita las solicitudes simultáneas al agregar una lista de jueces.
  for (let i = 0; i < emails.length; i += 4) {
    const batch = emails.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map((email) => sendAccountInvitation(scope, email)));
    results.forEach((result, index) => {
      if (result.status === "rejected") failed.push(batch[index]);
    });
  }
  return failed;
}

export async function inviteSavedAccounts(scope: InvitationScope, emails: string[]) {
  const failed = await sendInvitations(scope, emails);
  if (failed.length) throw new SavedInvitationError(
    `Los permisos se guardaron. No se pudo enviar el acceso a: ${failed.join(", ")}. Usa «Enviar acceso» para reintentarlo.`,
  );
}
