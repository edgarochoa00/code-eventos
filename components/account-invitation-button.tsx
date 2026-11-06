"use client";

import { Mail } from "lucide-react";
import { useState } from "react";
import type { InvitationScope } from "@/lib/account-invitations";
import { sendAccountInvitation } from "@/lib/account-invitation-client";
import { Button, useToast } from "./ui";

export function AccountInvitationButton({ scope, email, disabled = false }: {
  scope: InvitationScope; email: string; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return <Button variant="ghost" size="sm" loading={busy} disabled={disabled}
    aria-label={`Enviar acceso a ${email}`}
    onClick={async () => {
      setBusy(true);
      try {
        const result = await sendAccountInvitation(scope, email);
        toast(result.status === "recently-sent"
          ? "El acceso ya se envió hace menos de un minuto. Revisa también spam."
          : "Correo enviado. El enlace permite establecer o recuperar la contraseña.");
      } catch (error) {
        toast(error instanceof Error ? error.message : "No se pudo enviar el acceso.", "error");
      } finally { setBusy(false); }
    }}>
    <Mail className="size-4" /><span className="hidden sm:inline">Enviar acceso</span>
  </Button>;
}
