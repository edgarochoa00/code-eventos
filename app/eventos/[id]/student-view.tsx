"use client";

import { ArrowUpRight, CheckCircle2, Circle, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmissionBadges } from "@/components/project-bits";
import { ProjectForm } from "@/components/project-form";
import { ProjectRegistration } from "@/components/project-registration";
import { ProjectLogo } from "@/components/project-logo";
import { Badge, ButtonLink, Card, EmptyState, ErrorNote, SectionTitle, Spinner, Tabs, firestoreErrorMessage, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { createProject, qMyEventProject } from "@/lib/data";
import { useCollection } from "@/lib/hooks";
import { getPhaseLabel } from "@/lib/event-config";
import { PHASES, type EventDoc, type ProjectDoc } from "@/lib/types";
import { cn, eventCategories, normalizeEmail } from "@/lib/utils";

export function StudentView({ event }: { event: EventDoc }) {
  const { user } = useAuth();
  const email = normalizeEmail(user?.email ?? "");
  const router = useRouter();
  const toast = useToast();
  const mine = useCollection<ProjectDoc>(qMyEventProject(event.id, email), `myproject:${event.id}:${email}`);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const project = mine.data.find((p) => p.id === selectedProjectId) ?? mine.data[0];

  if (mine.loading) return <Spinner />;

  return (
    <div className="space-y-8">
      {mine.error && <ErrorNote code={mine.error} />}

      {project?.registrationPending && project.leaderId === user?.uid ? (
        <ProjectRegistration key={project.id} event={event} project={project} />
      ) : project ? (
        <>
          {mine.data.length > 1 && (
            <Tabs
              tabs={mine.data.map((p) => ({ id: p.id, label: p.title }))}
              value={project.id}
              onChange={setSelectedProjectId}
            />
          )}
          <ProjectProgress event={event} project={project} />
          <Link
            href={`/eventos/${event.id}/proyectos/${project.id}`}
            className="group ui-panel ui-interactive flex min-w-0 items-center gap-3 rounded-3xl p-4 text-ink sm:gap-4 sm:p-8"
          >
            {project.logo && <ProjectLogo project={project} compact />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[11px] text-muted">Tu proyecto</p>
                {project.category && <Badge>{project.category}</Badge>}
              </div>
              <h2 className="mt-1 break-words font-display text-xl font-bold leading-tight sm:text-2xl">{project.title}</h2>
              <p className="mt-2 text-sm font-medium">{project.stand ? `Stand: ${project.stand}` : "Sin stand asignado"}</p>
              <p className="mt-1 line-clamp-2 font-mono text-[11px] text-muted">{project.summary}</p>
              <div className="mt-4">
                <SubmissionBadges project={project} event={event} />
              </div>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-field text-ink transition group-hover:rotate-45">
              <ArrowUpRight className="size-5" />
            </span>
          </Link>
          {event.resultsPublished && !project.registrationPending && (
            <ButtonLink href={`/eventos/${event.id}/proyectos/${project.id}?tab=calificaciones`} variant="outline" className="w-full sm:w-auto">
              Ver calificaciones
            </ButtonLink>
          )}
        </>
      ) : event.registrationOpen && !event.resultsPublished && event.accessVersion === 1 ? (
        <Card className="sm:p-8">
          <SectionTitle title="Registra tu proyecto" subtitle="Solo una persona del equipo lo registra y agrega a los demás." />
          <ProjectForm
            leader={{ name: user?.displayName ?? "", email }}
            maxTeamSize={event.maxTeamSize}
            categories={eventCategories(event)}
            submitLabel="Registrar proyecto"
            onSubmit={async (input) => {
              if (!user) return;
              try {
                const { id, failedInvitations } = await createProject(event, input, user);
                if (failedInvitations.length) toast(`Proyecto registrado. Reintenta enviar acceso a ${failedInvitations.join(", ")} desde el proyecto.`, "error");
                else toast("Proyecto registrado.");
                router.push(`/eventos/${event.id}/proyectos/${id}`);
              } catch (err) {
                toast(firestoreErrorMessage(err), "error");
              }
            }}
          />
        </Card>
      ) : (
        <EmptyState
          icon={<Lock className="size-5" />}
          title={event.accessVersion !== 1 ? "Registro pendiente de actualización" : "El registro está cerrado"}
          text="Si tu equipo ya se registró, pide al líder que confirme que tu correo esté en la lista de integrantes."
        />
      )}
    </div>
  );
}

function ProjectProgress({ event, project }: { event: EventDoc; project: ProjectDoc }) {
  const steps = [
    { label: "Registro", done: true, note: "Listo" },
    ...PHASES.filter((p) => event.phases[p]).map((p) => ({
      label: getPhaseLabel(event, p),
      done: !!project[p],
      note: project[p] ? "Entregado" : event.submissions[p] ? "Abierto" : "Aún no abre",
    })),
  ];
  return (
    <ol className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
      {steps.map((s, i) => (
        <li key={s.label} className={cn("min-w-0 rounded-2xl border p-4", s.done ? "border-coal/25 bg-lime" : "border-line bg-surface shadow-panel")}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted">0{i + 1}</span>
            {s.done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4 text-ink/30" />}
          </div>
          <p className="mt-3 text-sm font-medium">{s.label}</p>
          <p className="font-mono text-[10px] text-muted">{s.note}</p>
        </li>
      ))}
    </ol>
  );
}
