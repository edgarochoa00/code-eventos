"use client";

import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import type { CreatedTeamAccount, TeamEnrollmentInput, TeamEnrollmentResult } from "@/lib/team-enrollment";
import type { EventDoc } from "@/lib/types";
import { Button, Field, Input, Modal, useToast } from "./ui";

export function TeamEnrollmentButton({ event, events }: { event?: EventDoc; events?: EventDoc[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const available = event ? [event] : events ?? [];
  return (
    <>
      <Button variant="outline" size="sm" disabled={!available.length || Boolean(event?.resultsPublished || event?.categoryLocked || event?.judgingOpen)} onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Dar de alta alumno líder
      </Button>
      <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title="Alta de alumno líder">
        {open && <EnrollmentForm events={available} onBusy={setBusy} onClose={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function EnrollmentForm({ events, onBusy, onClose }: {
  events: EventDoc[]; onBusy: (value: boolean) => void; onClose: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const event = events.find((item) => item.id === eventId);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TeamEnrollmentResult | null>(null);
  const [credentials, setCredentials] = useState<CreatedTeamAccount[]>([]);
  const disabled = !event || event.resultsPublished || event.categoryLocked || event.judgingOpen || event.accessVersion !== 1;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || busy) return;
    if (!event) {
      setError("El evento seleccionado ya no está disponible. Selecciona otro evento para continuar.");
      return;
    }
    setError("");
    setBusy(true);
    onBusy(true);
    try {
      const input: TeamEnrollmentInput = { eventId, email };
      const response = await fetch("/api/team-enrollment", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(input) });
      const data = await response.json();
      setCredentials((previous) => [...previous, ...((data.createdAccounts ?? []) as CreatedTeamAccount[])]);
      if (!response.ok) throw new Error(data.error ?? "No se pudo completar el alta.");
      setResult(data as TeamEnrollmentResult);
      toast("Alumno líder dado de alta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el alta. Intenta de nuevo.");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {!event && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        {events.length ? "El evento seleccionado ya no está disponible. Selecciona otro evento para continuar."
          : "Ya no hay eventos disponibles para dar de alta al alumno. Puedes conservar los accesos ya creados antes de cerrar."}
      </p>}
      {result ? (
        <div className="space-y-3" role="status">
          <p className="font-display text-lg font-bold">Alumno líder registrado</p>
          <p className="break-words text-sm text-muted">{email} · {event?.name ?? "Evento no disponible"}. Al iniciar sesión y verificar su correo,
            el alumno completará el formulario de su proyecto, elegirá la categoría y agregará a sus integrantes.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <p className="text-sm text-muted">Solo necesitas el correo del alumno líder. Él escribirá sus datos y los de su proyecto y registrará a sus integrantes cuando entre.</p>
          <fieldset disabled={busy} className="space-y-4">
            <Field label="Evento" htmlFor="enrollment-event">
              <select id="enrollment-event" className="h-11 w-full min-w-0 rounded-xl border-2 border-control bg-field px-3 text-base sm:text-sm"
                value={event?.id ?? ""} disabled={!events.length} onChange={(e) => { setEventId(e.target.value); setError(""); }}>
                {!event && <option value="">Selecciona un evento disponible</option>}
                {events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Correo del alumno líder" htmlFor="enrollment-email">
              <Input id="enrollment-email" autoComplete="off" type="email" inputMode="email" required maxLength={254} disabled={!event}
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {event && disabled && <p role="alert" className="text-sm text-red-600">{event.resultsPublished ? "Oculta los resultados antes de dar de alta líderes."
              : event.categoryLocked || event.judgingOpen ? "La evaluación ya comenzó; no se pueden dar de alta nuevos líderes."
                : "El superadmin debe actualizar los permisos del evento."}</p>}
            <Button type="submit" loading={busy} disabled={Boolean(disabled)}>Dar de alta líder</Button>
          </fieldset>
        </form>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {credentials.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-line bg-paper p-4">
          <p className="font-display font-bold">Acceso de la cuenta nueva</p>
          <p className="text-xs text-muted">Copia y comparte el acceso con el alumno antes de cerrar. La contraseña solo aparece aquí.
            Al iniciar sesión deberá verificar su correo. Puede cambiar la contraseña desde «Olvidé mi contraseña».</p>
          {!result && <p className="text-xs text-muted">La cuenta se creó, pero el alta al evento no se guardó. Conserva el acceso y vuelve a intentarlo.</p>}
          <ul className="space-y-3">{credentials.map((account) => <li key={account.email} className="min-w-0 text-sm">
            <p className="break-all">{account.email}</p><code className="block break-all select-all">{account.password}</code>
          </li>)}</ul>
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              await navigator.clipboard.writeText(credentials.map((account) => `Correo: ${account.email}\nContraseña: ${account.password}`).join("\n\n"));
              toast("Acceso copiado.");
            } catch { toast("Selecciona y copia el acceso de la lista.", "error"); }
          }}>Copiar acceso</Button>
        </div>
      )}
      {result && !credentials.length && <p className="text-sm text-muted">El correo ya tenía cuenta. Su contraseña se conservó.</p>}
      <Button variant="ghost" onClick={onClose} disabled={busy}>{result ? "Cerrar" : "Cancelar"}</Button>
    </div>
  );
}
