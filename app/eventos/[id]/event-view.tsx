"use client";

import { ArrowLeft, CalendarDays, Check, Share2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { EventStatus } from "@/components/event-card";
import { Badge, Button, EmptyState, Spinner, Tabs } from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { eventRef } from "@/lib/data";
import { useDocument } from "@/lib/hooks";
import type { EventDoc, EventRole } from "@/lib/types";
import { formatDate, normalizeEmail, rolesInEvent } from "@/lib/utils";
import { JudgeView } from "./judge-view";
import { OrganizerView } from "./organizer-view";
import { StudentView } from "./student-view";

const VIEW_LABEL: Record<EventRole, string> = { organizer: "Organizador", judge: "Juez", student: "Participante" };

export function EventView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const access = useAccess();
  const { data: event, loading, error } = useDocument<EventDoc>(eventRef(id), `event:${id}`);
  const [picked, setPicked] = useState<EventRole | null>(null);

  if (loading) return <Spinner />;
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

  const roles = rolesInEvent(event, user?.email, access.isAdmin);
  const role = picked && roles.includes(picked) ? picked : roles[0];
  // Admin global sin estar en la lista de organizadores del evento
  const viaAdmin = role === "organizer" && !event.organizerEmails.includes(normalizeEmail(user?.email ?? ""));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/panel" className="inline-flex items-center gap-1.5 font-mono text-xs text-ink/60 hover:text-ink">
          <ArrowLeft className="size-3.5" /> Panel
        </Link>
        {roles.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-ink/50">Ver como</span>
            <Tabs tabs={roles.map((r) => ({ id: r, label: VIEW_LABEL[r] }))} value={role} onChange={setPicked} />
          </div>
        )}
      </div>
      <EventHeader event={event} role={role} viaAdmin={viaAdmin} />
      {role === "organizer" && <OrganizerView event={event} />}
      {role === "judge" && <JudgeView event={event} />}
      {role === "student" && <StudentView event={event} />}
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
      <div className="flex flex-col justify-between gap-6 rounded-3xl bg-lime p-6 sm:p-8">
        <div>
          <p className="font-mono text-[11px] text-ink/70">Código del evento</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-[0.2em]">{event.code}</p>
          <p className="mt-2 font-mono text-[11px] text-ink/70">
            Etapas: {[event.phases.prototype && "Prototipo", event.phases.final && "Producto final"].filter(Boolean).join(" + ")}
            {" · "}Equipos de hasta {event.maxTeamSize}
          </p>
        </div>
        <Button variant="dark" onClick={share} className="self-start">
          {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
          {copied ? "Copiado" : "Compartir"}
        </Button>
      </div>
    </section>
  );
}
