"use client";

import { FolderKanban, Gavel, Plus, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EventCard } from "@/components/event-card";
import { SubmissionBadges } from "@/components/project-bits";
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
import { findEventByCode, qJudgeEvents, qMyProjects, qOpenEvents, qOrganizerEvents } from "@/lib/data";
import { useCollection } from "@/lib/hooks";
import type { EventDoc, ProjectDoc } from "@/lib/types";

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

  const mine = new Set([...organizing.data, ...judging.data].map((e) => e.id));
  const projectEvents = new Set(projects.data.map((p) => p.eventId));
  const discover = open.data.filter((e) => !mine.has(e.id) && !projectEvents.has(e.id));
  const loading = organizing.loading || judging.loading || projects.loading;
  const firstName = (user?.displayName ?? "").split(" ")[0];

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col justify-between gap-6 sm:p-8">
          <div>
            <p className="font-mono text-xs text-ink/50">Panel</p>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Hola{firstName ? `, ${firstName}` : ""}</h1>
            <p className="mt-2 max-w-md font-mono text-xs leading-relaxed text-ink/60">
              Aquí ves los eventos que organizas, los que evalúas y los proyectos de tu equipo.
            </p>
          </div>
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
        </Card>
        <form onSubmit={joinByCode} className="flex flex-col justify-between gap-5 rounded-3xl bg-lime p-6 sm:p-8">
          <div>
            <Ticket className="size-6" />
            <h2 className="mt-3 font-display text-xl font-bold">¿Tienes un código?</h2>
            <p className="mt-1 font-mono text-[11px] text-ink/70">Tu organizador lo comparte para registrar tu proyecto.</p>
          </div>
          <div className="flex gap-2">
            <Input
              aria-label="Código del evento"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="border-ink/20 bg-surface font-mono uppercase tracking-[0.3em]"
              autoCapitalize="characters"
            />
            <Button type="submit" variant="dark" loading={joining}>
              Ir
            </Button>
          </div>
        </form>
      </section>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <section>
            <SectionTitle title="Mis proyectos" subtitle="Proyectos donde eres integrante." />
            {projects.error && <ErrorNote code={projects.error} />}
            {projects.data.length ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
                {projects.data.map((p) => (
                  <Link
                    key={p.id}
                    href={`/eventos/${p.eventId}/proyectos/${p.id}`}
                    className="rounded-3xl bg-surface p-5 transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <FolderKanban className="size-5" />
                      {p.category && <Badge>{p.category}</Badge>}
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold">{p.title}</h3>
                    <p className="mt-1 line-clamp-2 font-mono text-[11px] text-ink/55">{p.summary}</p>
                    <div className="mt-4">
                      <SubmissionBadges project={p} />
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

          {judging.data.length > 0 && (
            <section>
              <SectionTitle title="Para evaluar" subtitle="Eventos donde eres juez." />
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
                {judging.data.map((e) => (
                  <EventCard key={e.id} event={e} role="judge" tone="dark" />
                ))}
              </div>
            </section>
          )}

          {(organizing.data.length > 0 || access.canCreateEvents) && (
            <section>
              <SectionTitle
                title="Organizo"
                subtitle={access.isAdmin ? "Eventos donde estás como organizador. Todos los eventos están en Administración." : "Eventos que creaste o administras."}
              />
              {organizing.data.length ? (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
                  {organizing.data.map((e) => (
                    <EventCard key={e.id} event={e} role="organizer" />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Gavel className="size-5" />}
                  title="No organizas eventos"
                  text="Crea uno para invitar jueces y abrir el registro de proyectos."
                />
              )}
            </section>
          )}

          {discover.length > 0 && (
            <section>
              <SectionTitle title="Registro abierto" subtitle="Eventos donde puedes inscribir tu proyecto." />
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
                {discover.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 font-mono text-[10px] text-ink/40">
        <Sparkles className="size-3" /> Todo se actualiza en tiempo real
      </p>
    </div>
  );
}
