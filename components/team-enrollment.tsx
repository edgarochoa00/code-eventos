"use client";

import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import type { TeamEnrollmentInput, TeamEnrollmentResult } from "@/lib/team-enrollment";
import type { EventDoc } from "@/lib/types";
import { Button, Field, Input, Modal, useToast } from "./ui";
import { AccountInvitationButton } from "./account-invitation-button";

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
      if (!response.ok) throw new Error(data.error ?? "No se pudo completar el alta.");
      setResult(data as TeamEnrollmentResult);
      toast(data.invitation === "failed" ? "El alta se guardó. Falta enviar el correo." : "Alumno líder registrado. Acceso enviado por correo.");
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
          : "Ya no hay eventos disponibles para dar de alta al alumno."}
      </p>}
      {result ? (
        <div className="space-y-3" role="status">
          <p className="font-display text-lg font-bold">Alumno líder registrado</p>
          <p className="break-words text-sm text-muted">{email} · {event?.name ?? "Evento no disponible"}</p>
          {result.invitation === "failed" ? (
            <>
              <p role="alert" className="text-sm text-muted">El lugar del líder se guardó. Usa «Enviar acceso» para volver a intentar el envío.</p>
              {event && <AccountInvitationButton scope={{ kind: "team", role: "leader", eventId, projectId: result.projectId }} email={email.trim()} />}
            </>
          ) : <p className="text-sm text-muted">El correo incluye el enlace para configurar el acceso. Después el líder podrá completar el formulario del proyecto.</p>}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <p className="text-sm text-muted">El alumno recibirá un correo para configurar su acceso y completar el formulario del proyecto.</p>
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
      <Button variant="ghost" onClick={onClose} disabled={busy}>{result ? "Cerrar" : "Cancelar"}</Button>
    </div>
  );
}
