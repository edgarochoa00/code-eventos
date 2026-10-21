"use client";

import { ArrowUpRight, CheckCircle2, Circle, Lock, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaderboard } from "@/components/leaderboard";
import { SubmissionBadges } from "@/components/project-bits";
import { ProjectForm } from "@/components/project-form";
import { Card, EmptyState, ErrorNote, SectionTitle, Spinner, firestoreErrorMessage, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { createProject, qMyEventProject } from "@/lib/data";
import { useCollection } from "@/lib/hooks";
import { PHASE_LABEL, PHASES, type EventDoc, type ProjectDoc } from "@/lib/types";
import { cn, normalizeEmail } from "@/lib/utils";

export function StudentView({ event }: { event: EventDoc }) {
  const { user } = useAuth();
  const email = normalizeEmail(user?.email ?? "");
  const router = useRouter();
  const toast = useToast();
  const mine = useCollection<ProjectDoc>(qMyEventProject(event.id, email), `myproject:${event.id}:${email}`);
  const project = mine.data[0];

  if (mine.loading) return <Spinner />;

  return (
    <div className="space-y-8">
      {mine.error && <ErrorNote code={mine.error} />}

      {project ? (
        <>
          <ProjectProgress event={event} project={project} />
          <Link
            href={`/eventos/${event.id}/proyectos/${project.id}`}
            className="group flex items-center justify-between gap-4 rounded-3xl bg-night p-6 text-white sm:p-8"
          >
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-white/60">Tu proyecto</p>
              <h2 className="mt-1 truncate font-display text-2xl font-bold">{project.title}</h2>
              <p className="mt-1 line-clamp-2 font-mono text-[11px] text-white/60">{project.summary}</p>
              <div className="mt-4">
                <SubmissionBadges project={project} event={event} />
              </div>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink transition group-hover:rotate-45">
              <ArrowUpRight className="size-5" />
            </span>
          </Link>
        </>
      ) : event.registrationOpen ? (
        <Card className="sm:p-8">
          <SectionTitle title="Registra tu proyecto" subtitle="Solo una persona del equipo lo registra y agrega a los demás." />
          <ProjectForm
            leader={{ name: user?.displayName ?? "", email }}
            maxTeamSize={event.maxTeamSize}
            submitLabel="Registrar proyecto"
            onSubmit={async (input) => {
              if (!user) return;
              try {
                const id = await createProject(event, input, user);
                toast("Proyecto registrado.");
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
          title="El registro está cerrado"
          text="Si tu equipo ya se registró, pide al líder que confirme que tu correo esté en la lista de integrantes."
        />
      )}

      {event.resultsPublished && event.results && (
        <section>
          <SectionTitle title="Resultados" subtitle="Publicados por el organizador." />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
            {PHASES.filter((p) => event.phases[p] && event.results?.[p]?.length).map((phase) => (
              <Card key={phase}>
                <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
                  <Trophy className="size-5" /> {PHASE_LABEL[phase]}
                </h3>
                <Leaderboard rows={event.results![phase].slice(0, 10)} eventId={event.id} highlightId={project?.id} />
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectProgress({ event, project }: { event: EventDoc; project: ProjectDoc }) {
  const steps = [
    { label: "Registro", done: true, note: "Listo" },
    ...PHASES.filter((p) => event.phases[p]).map((p) => ({
      label: PHASE_LABEL[p],
      done: !!project[p],
      note: project[p] ? "Entregado" : event.submissions[p] ? "Abierto" : "Aún no abre",
    })),
    { label: "Resultados", done: event.resultsPublished, note: event.resultsPublished ? "Publicados" : "Pendiente" },
  ];
  return (
    <ol className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
      {steps.map((s, i) => (
        <li key={s.label} className={cn("rounded-2xl p-4", s.done ? "bg-lime" : "bg-surface")}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-ink/50">0{i + 1}</span>
            {s.done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4 text-ink/30" />}
          </div>
          <p className="mt-3 text-sm font-medium">{s.label}</p>
          <p className="font-mono text-[10px] text-ink/60">{s.note}</p>
        </li>
      ))}
    </ol>
  );
}
