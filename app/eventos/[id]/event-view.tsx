"use client";

import { ArrowLeft, CalendarDays, Check, Share2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { EventStatus } from "@/components/event-card";
import { Badge, Button, EmptyState, Spinner, firestoreErrorMessage, useToast } from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { eventRef, prepareEventAccess, qMyEventProject } from "@/lib/data";
import { useCollection, useDocument } from "@/lib/hooks";
import { PHASE_LABEL, PHASES, type EventDoc, type EventRole, type ProjectDoc } from "@/lib/types";
import { formatDate, normalizeEmail, rolesInEvent } from "@/lib/utils";
import { JudgeView } from "./judge-view";
import { OrganizerView } from "./organizer-view";
import { StudentView } from "./student-view";

export function EventView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const access = useAccess();
  const { data: event, loading, error } = useDocument<EventDoc>(eventRef(id), `event:${id}`);
  const email = normalizeEmail(user?.email ?? "");
  const checkTeam = !!event && !access.isAdmin && event.judgeEmails.includes(email) && !event.organizerEmails.includes(email);
  const ownProjects = useCollection<ProjectDoc>(checkTeam ? qMyEventProject(id, email) : null, `role-team:${id}:${email}:${checkTeam}`);

  if (loading || access.loading || ownProjects.loading) return <Spinner />;
  if (error || !event) {
    return (
      <EmptyState
        title="Evento no encontrado"
        text={error === "permission-denied" ? "No tienes acceso a este evento." : "Revisa el enlace o el código."}
        action={
          <Link href="/panel" className="font-mono text-xs underline">
            Volver al panel
          </Link>
        }
      />
    );
  }

  const conflictingTeam = checkTeam && ownProjects.data.length > 0;
  const role = conflictingTeam ? "student" : rolesInEvent(event, email, access.isAdmin)[0];
  // Admin global sin estar en la lista de organizadores del evento
  const viaAdmin = role === "organizer" && !event.organizerEmails.includes(normalizeEmail(user?.email ?? ""));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/panel" className="inline-flex items-center gap-1.5 font-mono text-xs text-ink/60 hover:text-ink">
          <ArrowLeft className="size-3.5" /> Panel
        </Link>
      </div>
      <EventHeader event={event} role={role} viaAdmin={viaAdmin} />
      {conflictingTeam && <p className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">Tu correo aparece en un equipo y en la lista de jueces. Pide al organizador que retire el permiso de juez para poder seguir trabajando con tu equipo. Mientras tanto puedes consultar tu proyecto.</p>}
      {event.accessVersion !== 1 && <EventAccessNotice eventId={event.id} />}
      {role === "organizer" && <OrganizerView event={event} />}
      {role === "judge" && event.accessVersion === 1 && <JudgeView event={event} />}
      {role === "student" && <StudentView event={event} />}
    </div>
  );
}

function EventAccessNotice({ eventId }: { eventId: string }) {
  const access = useAccess();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 rounded-2xl bg-amber-50 p-5 text-amber-900">
      <p className="text-sm">
        Este evento necesita una actualización de permisos por el superadmin para registrar equipos, cambiar integrantes o roles y habilitar a los jueces.
        Los proyectos, entregas y calificaciones existentes se conservan.
      </p>
      {access.isSuperadmin && (
        <Button loading={busy} size="sm" onClick={async () => {
          setBusy(true);
          try {
            await prepareEventAccess(eventId);
            toast("Permisos actualizados.");
          } catch (err) {
            toast(firestoreErrorMessage(err), "error");
          } finally {
            setBusy(false);
          }
        }}>Actualizar permisos del evento</Button>
      )}
    </div>
  );
}

function EventHeader({ event, role, viaAdmin }: { event: EventDoc; role: EventRole; viaAdmin: boolean }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/eventos/${event.id}`;
    const text = `Registra tu proyecto en ${event.name}. Código: ${event.code}`;
    if (navigator.share) {
      await navigator.share({ title: event.name, text, url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="min-w-0 rounded-3xl bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap gap-1.5">
          <EventStatus event={event} />
          <Badge tone={role === "organizer" ? "dark" : role === "judge" ? "lime" : "neutral"}>
            {role === "organizer" ? (viaAdmin ? "Admin" : "Organizas") : role === "judge" ? "Eres juez" : "Participante"}
          </Badge>
        </div>
        <h1 className="mt-4 break-words font-display text-3xl font-bold leading-tight sm:text-4xl">{event.name}</h1>
        {event.institution && <p className="mt-1 font-mono text-xs text-ink/60">{event.institution}</p>}
        {event.description && (
          <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink/80">{event.description}</p>
        )}
        {(event.startDate || event.endDate) && (
          <p className="mt-4 flex items-center gap-1.5 font-mono text-[11px] text-ink/55">
            <CalendarDays className="size-3.5" /> {formatDate(event.startDate)}
            {event.endDate && ` – ${formatDate(event.endDate)}`}
          </p>
        )}
      </div>
      {role === "organizer" ? (
        // Solo el organizador necesita el código para invitar equipos
        <div className="flex flex-col justify-between gap-6 rounded-3xl bg-lime p-6 sm:p-8">
          <div>
            <p className="font-mono text-[11px] text-ink/70">Código para los equipos</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{event.code}</p>
            <p className="mt-2 font-mono text-[11px] text-ink/70">
              Etapas: {phaseNames(event)} · Equipos de hasta {event.maxTeamSize}
            </p>
          </div>
          <Button variant="dark" onClick={share} className="self-start">
            {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
            {copied ? "Copiado" : "Compartir"}
          </Button>
        </div>
      ) : (
        <StatusCard event={event} role={role} />
      )}
    </section>
  );
}

function phaseNames(event: EventDoc) {
  return [event.phases.prototype && "Prototipo", event.phases.final && "Producto final"].filter(Boolean).join(" + ");
}

/** Estado del evento desde el punto de vista del juez o del alumno. */
function StatusCard({ event, role }: { event: EventDoc; role: EventRole }) {
  const rows: { label: string; open: boolean; on: string; off: string }[] =
    role === "judge"
      ? [
          { label: "Evaluación", open: event.judgingOpen, on: "Abierta, ya puedes calificar", off: "Aún no abre" },
          ...PHASES.filter((p) => event.phases[p]).map((p) => ({
            label: PHASE_LABEL[p],
            open: event.submissions[p],
            on: "Los equipos están entregando",
            off: "Entregas cerradas",
          })),
          { label: "Resultados", open: event.resultsPublished, on: "Publicados", off: "Sin publicar" },
        ]
      : [
          { label: "Registro", open: event.registrationOpen, on: "Abierto", off: "Cerrado" },
          ...PHASES.filter((p) => event.phases[p]).map((p) => ({
            label: `Entrega de ${PHASE_LABEL[p].toLowerCase()}`,
            open: event.submissions[p],
            on: "Abierta",
            off: "Cerrada",
          })),
          { label: "Resultados", open: event.resultsPublished, on: "Publicados", off: "Pendientes" },
        ];

  return (
    <div className="rounded-3xl bg-lime p-6 sm:p-8">
      <p className="font-mono text-[11px] text-ink/70">{role === "judge" ? "Tu evaluación" : "Etapas del evento"}</p>
      <ul className="mt-3 divide-y divide-ink/10">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm font-medium">{r.label}</span>
            <span className="flex items-center gap-1.5 text-right font-mono text-[11px]">
              <span className={r.open ? "size-2 rounded-full bg-coal" : "size-2 rounded-full border border-coal/40"} aria-hidden />
              {r.open ? r.on : r.off}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[10px] text-ink/60">
        {role === "judge"
          ? `Rúbrica de ${event.criteria.length} criterio${event.criteria.length === 1 ? "" : "s"} · calificas de 0 a 10`
          : `Equipos de hasta ${event.maxTeamSize} integrantes`}
      </p>
    </div>
  );
}
