"use client";

import { FolderKanban, Gavel, Plus, ShieldCheck, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EventCard } from "@/components/event-card";
import { SubmissionBadges } from "@/components/project-bits";
import { ProjectRegistration } from "@/components/project-registration";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorNote,
  Input,
  SectionTitle,
  Spinner,
  useToast,
} from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { eventRef, findEventByCode, qJudgeEvents, qMyProjects, qOpenEvents, qOrganizerEvents } from "@/lib/data";
import { useCollection, useDocument } from "@/lib/hooks";
import type { EventDoc, ProjectDoc } from "@/lib/types";
import { rolesInEvent } from "@/lib/utils";

const GRID = "grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]";

function ProjectDeliveryBadges({ project }: { project: ProjectDoc }) {
  const event = useDocument<EventDoc>(eventRef(project.eventId), `project-event:${project.eventId}`);
  if (event.loading) return <span className="font-mono text-xs text-muted">Consultando entregas…</span>;
  if (!event.data) return <Badge>Evento no disponible</Badge>;
  return <SubmissionBadges project={project} event={event.data} />;
}

function PendingRegistration({ project }: { project: ProjectDoc }) {
  const { user } = useAuth();
  const event = useDocument<EventDoc>(eventRef(project.eventId), `pending-event:${project.eventId}`);
  if (event.loading) return <Spinner />;
  if (event.error) return <ErrorNote code={event.error} />;
  if (!event.data || !rolesInEvent(event.data, user?.email).includes("student")) return null;
  return <ProjectRegistration event={event.data} project={project} />;
}

export function Dashboard() {
  const { user } = useAuth();
  const access = useAccess();
  const email = user?.email ?? "";
  const router = useRouter();
  const toast = useToast();

  const organizing = useCollection<EventDoc>(email ? qOrganizerEvents(email) : null, `org:${email}`);
  const judging = useCollection<EventDoc>(email ? qJudgeEvents(email) : null, `judge:${email}`);
  const projects = useCollection<ProjectDoc>(email ? qMyProjects(email) : null, `projects:${email}`);
  const open = useCollection<EventDoc>(qOpenEvents(), "open");

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  async function joinByCode(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length < 4) return;
    setJoining(true);
    try {
      const id = await findEventByCode(code);
      if (id) router.push(`/eventos/${id}`);
      else toast("No encontramos un evento con ese código.", "error");
    } catch {
      toast("No se pudo buscar el evento.", "error");
    } finally {
      setJoining(false);
    }
  }

  const loading = organizing.loading || judging.loading || projects.loading;
  const pending = access.isAdmin ? [] : projects.data.filter((project) => project.registrationPending && project.leaderId === user?.uid);
  const firstName = (user?.displayName ?? "").split(" ")[0];

  // Qué tipo de usuario es, para mostrarle solo lo que le sirve
  const isStaff = access.canCreateEvents; // superadmin, admin u organizador global
  const contestantEvents = new Set(projects.data.map((project) => project.eventId));
  const judgeEvents = judging.data.filter((event) => rolesInEvent(event, email, access.isAdmin).includes("judge") && !contestantEvents.has(event.id));
  const isJudge = judgeEvents.length > 0;
  const organizesSomething = organizing.data.length > 0;
  const hasProjects = projects.data.length > 0;
  const isParticipant = !isStaff && !isJudge && !organizesSomething; // alumno

  const mine = new Set([...organizing.data, ...judging.data].map((e) => e.id));
  const projectEvents = new Set(projects.data.map((p) => p.eventId));
  const discover = open.data.filter((e) => !mine.has(e.id) && !projectEvents.has(e.id));

  let intro = "Registra tu proyecto con el código que te dio tu organizador y presenta las entregas que definió para tu evento.";
  if (access.isAdmin) intro = "Administras la plataforma: crea eventos, revisa todos en Administración y asigna jueces y permisos.";
  else if (isStaff) intro = "Crea tus eventos, invita jueces y sigue el avance de los equipos.";
  else if (organizesSomething) intro = "Administras los eventos donde te agregaron como organizador.";
  else if (isJudge)
    intro = `Tienes ${judgeEvents.length} evento${judgeEvents.length === 1 ? "" : "s"} para evaluar. Entra para calificar los proyectos.`;

  const codeCard = (
    <form onSubmit={joinByCode} className="flex flex-col justify-between gap-5 rounded-3xl bg-lime p-6 sm:p-8">
      <div>
        <Ticket className="size-6" />
        <h2 className="mt-3 font-display text-xl font-bold">{isParticipant ? "¿Tienes un código?" : "Ir a un evento"}</h2>
        <p className="mt-1 font-mono text-[11px] text-muted">
          {isParticipant
            ? "Tu organizador lo comparte para registrar tu proyecto."
            : "Escribe el código de 6 letras de un evento para abrirlo."}
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          aria-label="Código del evento"
          placeholder="ABC123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          className="bg-surface font-mono uppercase tracking-[0.3em]"
          autoCapitalize="characters"
        />
        <Button type="submit" variant="dark" loading={joining}>
          Ir
        </Button>
      </div>
    </form>
  );

  const myProjects = (
    <section>
      <SectionTitle title="Mis proyectos" subtitle="Proyectos donde eres integrante." />
      {projects.error && <ErrorNote code={projects.error} />}
      {hasProjects ? (
        <div className={GRID}>
          {projects.data.map((p) => (
            <Link
              key={p.id}
              href={`/eventos/${p.eventId}/proyectos/${p.id}`}
              className="min-w-0 ui-panel ui-interactive rounded-3xl p-5 transition hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <FolderKanban className="size-5 shrink-0" />
                {p.category && <Badge>{p.category}</Badge>}
              </div>
              <h3 className="mt-4 break-words font-display text-lg font-bold">{p.title || "Completa el registro de tu proyecto"}</h3>
              <p className="mt-1 line-clamp-2 font-mono text-[11px] text-muted">{p.summary}</p>
              <div className="mt-4">
                <ProjectDeliveryBadges project={p} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FolderKanban className="size-5" />}
          title="Aún no tienes proyectos"
          text="Entra a un evento con su código o elige uno abierto para registrar a tu equipo. Si un compañero ya te agregó, aparecerá aquí."
        />
      )}
    </section>
  );

  const judgingSection = isJudge && (
    <section>
      <SectionTitle title="Para evaluar" subtitle="Eventos donde eres juez." />
      <div className={GRID}>
        {judgeEvents.map((e) => (
          <EventCard key={e.id} event={e} role="judge" tone="dark" />
        ))}
      </div>
    </section>
  );

  const organizingSection = (organizesSomething || isStaff) && (
    <section>
      <SectionTitle
        title="Organizo"
        subtitle={
          access.isAdmin
            ? "Eventos donde estás como organizador. Todos los eventos están en Administración."
            : "Eventos que creaste o administras."
        }
      />
      {organizesSomething ? (
        <div className={GRID}>
          {organizing.data.map((e) => (
            <EventCard key={e.id} event={e} role="organizer" />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Gavel className="size-5" />}
          title="No organizas eventos"
          text="Crea uno para invitar jueces y abrir el registro de proyectos."
          action={
            <ButtonLink href="/eventos/nuevo" variant="dark" size="sm">
              <Plus className="size-4" /> Crear evento
            </ButtonLink>
          }
        />
      )}
    </section>
  );

  return (
    <div className="space-y-10">
      {pending.map((project) => <PendingRegistration key={project.id} project={project} />)}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col justify-between gap-6 sm:p-8">
          <div>
            <p className="font-mono text-xs text-muted">Panel</p>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Hola{firstName ? `, ${firstName}` : ""}</h1>
            <p className="mt-2 max-w-md font-mono text-xs leading-relaxed text-muted">{intro}</p>
          </div>
          {(access.canCreateEvents || access.isAdmin) && (
            <div className="flex flex-wrap gap-2">
              {access.canCreateEvents && (
                <ButtonLink href="/eventos/nuevo" variant="dark">
                  <Plus className="size-4" /> Crear evento
                </ButtonLink>
              )}
              {access.isAdmin && (
                <ButtonLink href="/admin" variant="outline">
                  <ShieldCheck className="size-4" /> Administración
                </ButtonLink>
              )}
            </div>
          )}
        </Card>
        {codeCard}
      </section>

      {loading ? (
        <Spinner />
      ) : isParticipant ? (
        <>
          {myProjects}
          {discover.length > 0 && (
            <section>
              <SectionTitle title="Registro abierto" subtitle="Eventos donde puedes inscribir tu proyecto." />
              <div className={GRID}>
                {discover.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {/* Jueces, organizadores y admins: primero su trabajo; "Mis proyectos" solo si tienen alguno */}
          {judgingSection}
          {organizingSection}
          {hasProjects && myProjects}
        </>
      )}
    </div>
  );
}
