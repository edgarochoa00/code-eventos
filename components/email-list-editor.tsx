"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { parseEmails } from "@/lib/utils";
import { Badge, Button, Card, SectionTitle, Textarea, firestoreErrorMessage, useToast } from "./ui";

/** Lista editable de correos (jueces u organizadores de un evento). */
export function EmailListEditor({
  title,
  subtitle,
  emails,
  locked = [],
  onSave,
  progress,
}: {
  title: string;
  subtitle: string;
  emails: string[];
  locked?: string[];
  onSave: (emails: string[]) => Promise<void>;
  progress?: (email: string) => string | null;
}) {
  const toast = useToast();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(next: string[]) {
    setBusy(true);
    try {
      await onSave(next);
      return true;
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
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
          if (await save(Array.from(new Set([...emails, ...added])))) {
            setRaw("");
            toast(`${added.length} correo(s) agregado(s).`);
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
      </form>
      <ul className="mt-5 divide-y divide-ink/5">
        {emails.map((email) => (
          <li key={email} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm">{email}</p>
              {progress && <p className="font-mono text-[10px] text-ink/50">{progress(email)}</p>}
            </div>
            {locked.includes(email) ? (
              <Badge>Creador</Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Quitar ${email}`}
                onClick={() => save(emails.filter((e) => e !== email))}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
        {!emails.length && <li className="py-3 font-mono text-xs text-ink/50">Nadie todavía.</li>}
      </ul>
    </Card>
  );
}
