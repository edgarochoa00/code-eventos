"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import type { GlobalRole } from "@/lib/types";
import { initials } from "@/lib/utils";

const ROLE_LABELS: Record<GlobalRole, string> = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  organizer: "Organizador",
  blocked: "Cuenta suspendida",
  user: "Según el evento",
};

function accountDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-MX", { dateStyle: "long" });
}

export function ProfileView() {
  const { user } = useAuth();
  const access = useAccess();
  if (!user) return null;

  const email = user.email ?? "";
  const created = accountDate(user.metadata.creationTime);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/panel" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Volver al panel
      </Link>
      <Card className="mt-2 sm:p-8">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-lime font-display text-lg font-bold text-coal" aria-hidden>
            {initials(user.displayName || email)}
          </span>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Mi perfil</h1>
        </div>
        <NameForm key={user.uid} displayName={user.displayName ?? ""} />
        <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold text-muted">Correo electrónico</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-medium [overflow-wrap:anywhere]">{email || "Sin correo asociado"}</span>
              {email && <Badge tone={user.emailVerified ? "green" : "amber"}>{user.emailVerified ? "Verificado" : "Sin verificar"}</Badge>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted">Permiso general</dt>
            <dd className="mt-1 font-medium">{access.loading ? "Consultando…" : ROLE_LABELS[access.role]}</dd>
          </div>
          {created && (
            <div>
              <dt className="text-xs font-semibold text-muted">Cuenta creada</dt>
              <dd className="mt-1 font-medium">{created}</dd>
            </div>
          )}
        </dl>
      </Card>
    </div>
  );
}

function NameForm({ displayName }: { displayName: string }) {
  const { updateName } = useAuth();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const name = draft ?? displayName;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const clean = name.trim();
    if (clean.length < 2) return setError("Escribe un nombre de al menos 2 caracteres.");
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await updateName(clean);
      setDraft(null);
      setSaved(true);
    } catch {
      setError("No pudimos terminar de guardar tu nombre. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-3">
      <Field label="Nombre completo" htmlFor="profile-name">
        <Input id="profile-name" name="name" autoComplete="name" placeholder="Escribe tu nombre" value={name}
          onChange={(event) => { setDraft(event.target.value); setSaved(false); setError(""); }}
          minLength={2} maxLength={80} disabled={saving} required />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={saving} disabled={!name.trim() || (name.trim() === displayName && !error)}>Guardar nombre</Button>
        {saved && <p role="status" className="text-sm font-medium text-ink">Nombre guardado.</p>}
        {error && <p role="alert" className="text-sm font-medium text-ink">{error}</p>}
      </div>
    </form>
  );
}
