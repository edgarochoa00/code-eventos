"use client";

import { ArrowLeft, Lock, MessageSquareQuote, Pencil, ScanSearch, Trophy, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EvaluationForm } from "@/components/evaluation-form";
import { MatchList, NotEnoughData, SimilarityBadge, SubmissionBadges } from "@/components/project-bits";
import { ProjectForm } from "@/components/project-form";
import { SubmissionEditor, SubmissionView } from "@/components/submission";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionTitle,
  Spinner,
  Tabs,
  firestoreErrorMessage,
  useToast,
} from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import {
  evaluationId,
  evaluationsCol,
  eventRef,
  projectRef,
  saveEvaluation,
  saveSubmission,
  updateProjectInfo,
} from "@/lib/data";
import { useCollection, useDocument, useFingerprints } from "@/lib/hooks";
import { analysisState, findMatches } from "@/lib/similarity";
import { query, where } from "firebase/firestore";
import {
  PHASE_LABEL,
  PHASES,
  type EvaluationDoc,
  type EventDoc,
  type EventRole,
  type Phase,
  type ProjectDoc,
} from "@/lib/types";
import { judgesSeeOriginality, normalizeEmail, rolesInEvent, teamsSeeOriginality } from "@/lib/utils";

type Tab = "info" | Phase | "evaluate" | "originality" | "scores" | "feedback";

export function ProjectView() {
  const { id, pid } = useParams<{ id: string; pid: string }>();
  const { user } = useAuth();
  const access = useAccess();
  const event = useDocument<EventDoc>(eventRef(id), `event:${id}`);
  const project = useDocument<ProjectDoc>(projectRef(id, pid), `project:${id}:${pid}`);

  if (event.loading || project.loading) return <Spinner />;
  if (!event.data || !project.data) {
    return (
      <EmptyState
        icon={<Lock className="size-5" />}
        title="No disponible"
        text={
          project.error === "permission-denied"
            ? "Solo los integrantes, jueces y organizadores pueden ver este proyecto."
            : "Este proyecto no existe."
        }
        action={
          <Link href={`/eventos/${id}`} className="font-mono text-xs underline">
            Volver al evento
          </Link>
        }
      />
    );
  }

  const email = normalizeEmail(user?.email ?? "");
  const roles = rolesInEvent(event.data, email, access.isAdmin);
  const isMember = project.data.memberEmails.includes(email);
  return <ProjectBody event={event.data} project={project.data} roles={roles} isMember={isMember} />;
}

function ProjectBody({
  event,
  project,
  roles,
  isMember,
}: {
  event: EventDoc;
  project: ProjectDoc;
  roles: EventRole[];
  isMember: boolean;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const phases = PHASES.filter((p) => event.phases[p]);
  const isOrganizer = roles.includes("organizer");
  const isJudge = roles.includes("judge");
  const canReview = isOrganizer || isJudge;
  // Quién ve el análisis de originalidad (lo controla el organizador en Ajustes)
  const teamView = !canReview && isMember;
  const seeOriginality = isOrganizer || (isJudge && judgesSeeOriginality(event)) || (teamView && teamsSeeOriginality(event));
  const firstPhase = phases.find((p) => project[p]) ?? phases[0];
  const [tab, setTab] = useState<Tab>(isJudge ? "evaluate" : isMember && !isOrganizer ? (firstPhase ?? "info") : "info");
  const [editingInfo, setEditingInfo] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [evalPhase, setEvalPhase] = useState<Phase>(firstPhase ?? "prototype");

  const canEditInfo = isOrganizer || (isMember && (event.registrationOpen || phases.some((p) => event.submissions[p])));

  // Evaluaciones: el juez ve las suyas, el organizador todas las del proyecto
  const evalQuery = isOrganizer
    ? query(evaluationsCol(event.id), where("projectId", "==", project.id))
    : isJudge && user
      ? query(evaluationsCol(event.id), where("judgeId", "==", user.uid), where("projectId", "==", project.id))
      : null;
  const evaluations = useCollection<EvaluationDoc>(evalQuery, `evals:${event.id}:${project.id}:${isOrganizer}:${isJudge}`);

  const fingerprints = useFingerprints(seeOriginality);
  const { matches, state } = useMemo(() => {
    const fp = fingerprints.data.find((f) => f.projectId === project.id);
    const s = analysisState(fp);
    return { state: s, matches: fp && s === "ready" ? findMatches(fp, fingerprints.data) : [] };
  }, [fingerprints.data, project.id]);

  const leader = project.members.find((m) => m.email === project.leaderEmail) ?? { name: "", email: project.leaderEmail };
  const hasFeedback = event.resultsPublished && project.feedback && Object.keys(project.feedback).length > 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "info", label: "Información" },
    ...phases.map((p) => ({ id: p as Tab, label: PHASE_LABEL[p] })),
    ...(isJudge ? [{ id: "evaluate" as Tab, label: "Evaluar" }] : []),
    ...(seeOriginality ? [{ id: "originality" as Tab, label: "Originalidad" }] : []),
    ...(isOrganizer ? [{ id: "scores" as Tab, label: "Calificaciones" }] : []),
    ...(isMember && hasFeedback ? [{ id: "feedback" as Tab, label: "Resultados" }] : []),
  ];

  return (
    <div className="space-y-6">
      <Link href={`/eventos/${event.id}`} className="inline-flex items-center gap-1.5 font-mono text-xs text-ink/60 hover:text-ink">
        <ArrowLeft className="size-3.5" /> {event.name}
      </Link>

      <section className="rounded-3xl bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-1.5">
          {project.category && <Badge tone="dark">{project.category}</Badge>}
          <SubmissionBadges project={project} event={event} />
          {canReview && seeOriginality && !fingerprints.loading && <SimilarityBadge match={matches[0]} state={state} />}
        </div>
        <h1 className="mt-4 break-words font-display text-3xl font-bold leading-tight sm:text-4xl">{project.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/75">{project.summary}</p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {project.members.map((m) => (
            <li key={m.email} className="flex items-center gap-2 rounded-full bg-paper py-1.5 pl-1.5 pr-3">
              <span className="grid size-6 place-items-center rounded-full bg-lime">
                <UserRound className="size-3.5" />
              </span>
              <span className="text-xs">
                {m.name || m.email}
                {m.email === project.leaderEmail && <span className="font-mono text-[10px] text-ink/50"> · líder</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Tabs tabs={tabs} value={tab} onChange={(t) => setTab(t)} />

      {tab === "info" && (
        <Card>
          {editingInfo ? (
            <ProjectForm
              initial={project}
              leader={leader}
              maxTeamSize={event.maxTeamSize}
              submitLabel="Guardar"
              onCancel={() => setEditingInfo(false)}
              onSubmit={async (input) => {
                try {
                  await updateProjectInfo(event, project, input);
                  toast("Proyecto actualizado.");
                  setEditingInfo(false);
                } catch (err) {
                  toast(firestoreErrorMessage(err), "error");
                }
              }}
            />
          ) : (
            <>
              <SectionTitle
                title="Información"
                action={
                  canEditInfo && (
                    <Button variant="outline" size="sm" onClick={() => setEditingInfo(true)}>
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                  )
                }
              />
              <dl className="space-y-5">
                <InfoBlock label="Problema" text={project.problem} />
                <InfoBlock label="Solución" text={project.solution} />
                {project.technologies.length > 0 && (
                  <div>
                    <dt className="font-mono text-[11px] text-ink/50">Tecnologías</dt>
                    <dd className="mt-2 flex flex-wrap gap-1.5">
                      {project.technologies.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </Card>
      )}

      {phases.map(
        (phase) =>
          tab === phase && (
            <Card key={phase}>
              {editingPhase === phase || (isMember && !project[phase] && event.submissions[phase]) ? (
                <>
                  <SectionTitle title={`Entrega: ${PHASE_LABEL[phase]}`} />
                  <SubmissionEditor
                    eventId={event.id}
                    projectId={project.id}
                    phase={phase}
                    initial={project[phase]}
                    userEmail={normalizeEmail(user?.email ?? "")}
                    onCancel={project[phase] ? () => setEditingPhase(null) : undefined}
                    onSave={async (submission) => {
                      await saveSubmission(event, project, phase, submission);
                      toast(`${PHASE_LABEL[phase]} guardado.`);
                      setEditingPhase(null);
                    }}
                  />
                </>
              ) : (
                <>
                  <SectionTitle
                    title={`Entrega: ${PHASE_LABEL[phase]}`}
                    action={
                      (isMember || isOrganizer) &&
                      project[phase] &&
                      (event.submissions[phase] || isOrganizer) && (
                        <Button variant="outline" size="sm" onClick={() => setEditingPhase(phase)}>
                          <Pencil className="size-3.5" /> Editar
                        </Button>
                      )
                    }
                  />
                  {isMember && !event.submissions[phase] && !project[phase] && (
                    <p className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 font-mono text-[11px] text-amber-800">
                      <Lock className="size-3.5" /> Las entregas de {PHASE_LABEL[phase].toLowerCase()} están cerradas por ahora.
                    </p>
                  )}
                  <SubmissionView submission={project[phase]} phase={phase} />
                </>
              )}
            </Card>
          ),
      )}

      {tab === "evaluate" && isJudge && user && (
        <Card>
          <SectionTitle title="Tu calificación" subtitle="Califica cada etapa por separado." />
          {phases.length > 1 && (
            <div className="mb-5">
              <Tabs tabs={phases.map((p) => ({ id: p, label: PHASE_LABEL[p] }))} value={evalPhase} onChange={setEvalPhase} />
            </div>
          )}
          {evaluations.loading ? (
            <Spinner />
          ) : (
            <>
              {!project[evalPhase] && (
                <p className="mb-4 rounded-xl bg-paper px-3 py-2.5 font-mono text-[11px] text-ink/60">
                  El equipo aún no entrega su {PHASE_LABEL[evalPhase].toLowerCase()}. Puedes calificar si lo presentaron en
                  vivo.
                </p>
              )}
              <EvaluationForm
                key={evalPhase}
                criteria={event.criteria}
                locked={!event.judgingOpen}
                initial={evaluations.data.find((e) => e.id === evaluationId(user.uid, project.id, evalPhase)) ?? null}
                onSave={async (scores, total, comment) => {
                  try {
                    await saveEvaluation(event, project.id, evalPhase, user, scores, total, comment);
                    toast("Calificación guardada.");
                  } catch (err) {
                    toast(firestoreErrorMessage(err), "error");
                  }
                }}
              />
            </>
          )}
        </Card>
      )}

      {tab === "originality" && seeOriginality && (
        <Card>
          <SectionTitle
            title="Análisis de originalidad"
            subtitle={
              teamView
                ? "Así se compara tu proyecto con los demás registrados en la plataforma."
                : "Comparado contra todos los proyectos registrados en la plataforma, de cualquier evento y año."
            }
            action={
              <Button variant="outline" size="sm" onClick={fingerprints.reload} loading={fingerprints.loading}>
                <ScanSearch className="size-3.5" /> Volver a analizar
              </Button>
            }
          />
          {fingerprints.loading ? (
            <Spinner label="Comparando" />
          ) : state !== "ready" ? (
            <NotEnoughData state={state} />
          ) : (
            <MatchList matches={matches.slice(0, 8)} currentEventId={event.id} anonymous={teamView} />
          )}
          <p className="mt-5 font-mono text-[10px] leading-relaxed text-ink/45">
            El porcentaje es una señal, no un veredicto. Combina frases y vocabulario en común, enlaces compartidos
            (repositorio, video, Drive) y archivos idénticos.
            {teamView ? " Si crees que hay un error, habla con el organizador." : " Revisa el caso antes de tomar una decisión."}
          </p>
        </Card>
      )}

      {tab === "scores" && isOrganizer && (
        <Card>
          <SectionTitle title="Calificaciones de jueces" subtitle="Solo los organizadores ven quién calificó qué." />
          {evaluations.data.length ? (
            <div className="space-y-3">
              {evaluations.data.map((e) => (
                <div key={e.id} className="rounded-2xl bg-paper p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{e.judgeName || e.judgeEmail}</p>
                      <p className="font-mono text-[10px] text-ink/50">{PHASE_LABEL[e.phase]}</p>
                    </div>
                    <p className="font-display text-2xl font-bold tabular-nums">{e.total.toFixed(1)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {event.criteria.map((c) => (
                      <Badge key={c.id}>
                        {c.name}: {e.scores[c.id] ?? "—"}
                      </Badge>
                    ))}
                  </div>
                  {e.comment && <p className="mt-3 text-sm leading-relaxed text-ink/75">“{e.comment}”</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="font-mono text-xs text-ink/50">Ningún juez ha calificado este proyecto.</p>
          )}
        </Card>
      )}

      {tab === "feedback" && hasFeedback && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
          {phases
            .filter((p) => project.feedback?.[p])
            .map((p) => {
              const fb = project.feedback![p]!;
              return (
                <Card key={p}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-[11px] text-ink/50">{PHASE_LABEL[p]}</p>
                      <p className="mt-1 font-display text-4xl font-bold tabular-nums">
                        {fb.score.toFixed(1)}
                        <span className="text-base font-normal text-ink/40">/100</span>
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-2xl bg-lime px-3 py-2 font-mono text-xs font-bold">
                      <Trophy className="size-4" /> {fb.rank}° de {fb.of}
                    </span>
                  </div>
                  <div className="mt-5 space-y-2.5">
                    {event.criteria.map((c) => (
                      <div key={c.id}>
                        <div className="flex justify-between font-mono text-[11px]">
                          <span>{c.name}</span>
                          <span>{fb.criteria[c.id] ?? "—"}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-ink/5">
                          <div className="h-full rounded-full bg-ink" style={{ width: `${(fb.criteria[c.id] ?? 0) * 10}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {fb.comments.length > 0 && (
                    <div className="mt-6 space-y-2">
                      <p className="flex items-center gap-1.5 font-mono text-[11px] text-ink/50">
                        <MessageSquareQuote className="size-3.5" /> Comentarios de los jueces
                      </p>
                      {fb.comments.map((c, i) => (
                        <p key={i} className="rounded-2xl bg-paper p-3 text-sm leading-relaxed">
                          {c}
                        </p>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] text-ink/50">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed">{text}</dd>
    </div>
  );
}
