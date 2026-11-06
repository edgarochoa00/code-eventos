"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { SavedInvitationError, type InvitationScope } from "@/lib/account-invitations";
import { displayEmail, parseEmails } from "@/lib/utils";
import { AccountInvitationButton } from "./account-invitation-button";
import { Badge, Button, Card, SectionTitle, Textarea, firestoreErrorMessage, useToast } from "./ui";

/** Lista editable de correos (jueces u organizadores de un evento). */
export function EmailListEditor({
  title,
  subtitle,
  emails,
  locked = [],
  onSave,
  progress,
  invitation,
}: {
  title: string;
  subtitle: string;
  emails: string[];
  locked?: string[];
  onSave: (emails: string[]) => Promise<void>;
  progress?: (email: string) => string | null;
  invitation?: InvitationScope;
}) {
  const toast = useToast();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [mailError, setMailError] = useState("");

  async function save(next: string[]) {
    setBusy(true);
    try {
      await onSave(next);
      setMailError("");
      return true;
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
      if (err instanceof SavedInvitationError) {
        setMailError(err.message);
        return "mail-failed" as const;
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle title={title} subtitle={subtitle} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const added = parseEmails(raw);
          if (!added.length) return toast("Escribe al menos un correo válido.", "error");
          const result = await save(Array.from(new Set([...emails, ...added])));
          if (result) {
            setRaw("");
            if (result === true) toast(`${added.length} correo(s) agregado(s).${invitation ? " Acceso enviado por correo." : ""}`);
          }
        }}
        className="space-y-3"
      >
        <Textarea
          aria-label="Correos"
          rows={2}
          placeholder="juez1@escuela.mx, juez2@gmail.com"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <Button type="submit" size="sm" loading={busy}>
          <Plus className="size-4" /> Agregar
        </Button>
        {invitation && <p className="text-xs leading-relaxed text-muted">Al agregar un correo se envía un enlace para establecer la contraseña.
          El mensaje de Firebase puede decir «restablecer contraseña»; también sirve para elegirla por primera vez.
          Si la persona ya tiene cuenta, conserva su acceso hasta que decida cambiar la contraseña. Puede revisar también spam.</p>}
      </form>
      {mailError && <p role="alert" className="mt-3 break-words rounded-xl bg-red-50 p-3 text-xs text-red-700">{mailError}</p>}
      <ul className="mt-5 divide-y divide-line">
        {emails.map((email) => (
          <li key={email} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm">{displayEmail(email)}</p>
              {progress && <p className="font-mono text-[10px] text-muted">{progress(email)}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
            {invitation && !locked.includes(email) && <AccountInvitationButton scope={invitation} email={email} disabled={busy} />}
            {locked.includes(email) ? (
              <Badge>Creador</Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Quitar ${displayEmail(email)}`}
                onClick={() => save(emails.filter((e) => e !== email))}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
            </div>
          </li>
        ))}
        {!emails.length && <li className="py-3 font-mono text-xs text-muted">Nadie todavía.</li>}
      </ul>
    </Card>
  );
}
