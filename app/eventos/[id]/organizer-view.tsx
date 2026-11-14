"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Download,
  EyeOff,
  Gavel,
  MapPin,
  Megaphone,
  RefreshCw,
  ScanSearch,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { JudgingControl } from "@/components/judging-agenda";
import { ProjectJudgeAssignments } from "@/components/project-judge-assignment";
import { scheduleLabel, scheduleError, scheduleInputValue, scheduleInputToIso } from "@/lib/judging-agenda";
import { CategoryCriteriaEditor } from "@/components/category-criteria-editor";
import { EmailListEditor } from "@/components/email-list-editor";
import { EventSettingsForm } from "@/components/event-settings-form";
import { TeamEnrollmentButton } from "@/components/team-enrollment";
import { Leaderboard } from "@/components/leaderboard";
import { SimilarityBadge, SubmissionBadges } from "@/components/project-bits";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Modal,
  SectionTitle,
  Spinner,
  Tabs,
  Toggle,
  firestoreErrorMessage,
  useToast,
} from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import {
  computeStandings,
  deleteEvent,
  evaluationsCol,
  generateUniqueEventCode,
  projectsCol,
  publishResults,
  saveCategoryCriteria,
  saveProjectStand,
  saveEventEmails,
  saveJudgeAssignment,
  unpublishResults,
  updateEvent,
} from "@/lib/data";
import { useCollection, useFingerprints } from "@/lib/hooks";
import { resultRubricColumns } from "@/lib/results";
import { criteriaError, getCategoryCriteria, getPhaseLabel } from "@/lib/event-config";
import { analysisState, findMatches, type AnalysisState } from "@/lib/similarity";
import {
  PHASES,
  type Criterion,
  type EvaluationDoc,
  type EventDoc,
  type JudgeAssignment,
  type Phase,
  type ProjectDoc,
} from "@/lib/types";
import {
  cn,
  displayEmail,
  downloadCsv,
  effectiveEvaluationTotal,
  eventCategories,
  hasJudgeAssignment,
  isProjectAssignedToJudge,
  normalizeEmail,
} from "@/lib/utils";

type Tab = "summary" | "projects" | "judges" | "statistics" | "rubric" | "results" | "settings";

export function OrganizerView({ event }: { event: EventDoc }) {
  const [tab, setTab] = useState<Tab>("summary");
  const projects = useCollection<ProjectDoc>(projectsCol(event.id), `projects:${event.id}`);
  const evaluations = useCollection<EvaluationDoc>(evaluationsCol(event.id), `evals:${event.id}`);
  const fingerprints = useFingerprints(true);

  // Solo se compara lo que tiene información suficiente; lo demás se marca "sin datos"
  const analysis = useMemo<Analysis>(() => {
    const top = new Map<string, Match | undefined>();
    const state = new Map<string, AnalysisState>();
    for (const p of projects.data) {
      const fp = fingerprints.data.find((f) => f.projectId === p.id);
      const s = analysisState(fp);
      state.set(p.id, s);
      top.set(p.id, fp && s === "ready" ? findMatches(fp, fingerprints.data)[0] : undefined);
    }
    return { top, state, loading: fingerprints.loading, historyCount: fingerprints.data.length };
  }, [projects.data, fingerprints.data, fingerprints.loading]);

  if (projects.loading || evaluations.loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <Tabs
        tabs={[
          { id: "summary", label: "Resumen" },
          { id: "projects", label: "Proyectos", count: projects.data.length },
          { id: "judges", label: "Jueces", count: event.judgeEmails.length },
          { id: "statistics", label: "Estadísticas" },
          { id: "rubric", label: "Rúbrica" },
          { id: "results", label: "Resultados" },
          { id: "settings", label: "Ajustes" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {(projects.error || evaluations.error) && <ErrorNote code={projects.error ?? evaluations.error ?? ""} />}

      {tab === "summary" && (
        <Summary event={event} projects={projects.data} analysis={analysis} onGo={setTab} />
      )}
      {tab === "projects" && (
        <ProjectsTab
          event={event}
          projects={projects.data}
          evaluations={evaluations.data}
          analysis={analysis}
          onReload={fingerprints.reload}
        />
      )}
      {tab === "judges" && <JudgesTab event={event} projects={projects.data.filter((p) => !p.registrationPending)} />}
      {tab === "statistics" && <JudgingControl event={event} projects={projects.data} evaluations={evaluations.data} />}
      {tab === "rubric" && <RubricTab event={event} projects={projects.data} hasEvaluations={evaluations.data.length > 0} />}
      {tab === "results" && <ResultsTab event={event} projects={projects.data} evaluations={evaluations.data} />}
      {tab === "settings" && <SettingsTab event={event} />}
    </div>
  );
}

/* ---------- Resumen y etapas ---------- */

function Summary({
  event,
  projects,
  analysis,
  onGo,
}: {
  event: EventDoc;
  projects: ProjectDoc[];
  analysis: Analysis;
  onGo: (t: Tab) => void;
}) {
  const toast = useToast();
  const phases = PHASES.filter((p) => event.phases[p]);

  async function toggle(patch: Partial<EventDoc>) {
    try {
      await updateEvent(event.id, patch);
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
    }
  }

  const stats = [
    { label: "Proyectos", value: projects.length },
    ...phases.map((ph) => {
      const label = getPhaseLabel(event, ph);
      return {
        label: phases.length === 1 && label.toLowerCase() === "entrega" ? "Entregas" : `Entregas: ${label}`,
        value: projects.filter((p) => p[ph]).length,
      };
    }),
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <SectionTitle title="Etapas" subtitle="Abre y cierra cada etapa cuando quieras. Los cambios son inmediatos." />
        <div className="divide-y divide-line">
          <Toggle
            label="Registro de proyectos"
            description="Los equipos pueden registrarse y editar su información."
            checked={event.registrationOpen}
            onChange={(v) => toggle({ registrationOpen: v })}
          />
          {phases.map((ph) => {
            const label = getPhaseLabel(event, ph);
            return (
              <Toggle
                key={ph}
                label={phases.length === 1 && label.toLowerCase() === "entrega" ? "Recepción de entregas" : `Recibir: ${label}`}
                description="Los equipos pueden subir o actualizar esta entrega."
                checked={event.submissions[ph]}
                onChange={(v) => toggle({ submissions: { ...event.submissions, [ph]: v } })}
              />
            );
          })}
          <Toggle
            label="Evaluación de jueces"
            description={event.resultsPublished ? "Oculta los resultados antes de reabrir la evaluación." : event.judgeEmails.length ? "Los jueces pueden calificar." : "Primero invita jueces."}
            checked={event.judgingOpen}
            disabled={event.resultsPublished || event.accessVersion !== 1}
            onChange={(v) => toggle({ judgingOpen: v })}
          />
        </div>
      </Card>

      <div className="space-y-4">
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
          {stats.map((s) => (
            <div key={s.label} className="ui-panel rounded-3xl p-5">
              <p className="font-display text-3xl font-bold tabular-nums">{s.value}</p>
              <p className="mt-1 font-mono text-[11px] text-muted">{s.label}</p>
            </div>
          ))}
        </div>
        <OriginalityCard event={event} projects={projects} analysis={analysis} onGo={onGo} />
        {!event.judgeEmails.length && (
          <button onClick={() => onGo("judges")} className="flex w-full items-center gap-4 rounded-3xl bg-lime p-5 text-left">
            <UserPlus className="size-5" />
            <span className="flex-1 font-mono text-xs">Invita a tus jueces para que puedan calificar</span>
            <ArrowUpRight className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Originalidad ---------- */

type Match = ReturnType<typeof findMatches>[number];
type Analysis = {
  top: Map<string, Match | undefined>;
  state: Map<string, AnalysisState>;
  loading: boolean;
  historyCount: number;
};

function OriginalityCard({
  projects,
  analysis,
  onGo,
}: {
  event: EventDoc;
  projects: ProjectDoc[];
  analysis: Analysis;
  onGo: (t: Tab) => void;
}) {
  const ready = projects.filter((p) => analysis.state.get(p.id) === "ready");
  const thin = projects.length - ready.length;
  const flagged = ready.filter((p) => {
    const m = analysis.top.get(p.id);
    return m && (m.level === "alto" || m.level === "medio");
  });

  // Cada estado dice algo verdadero: no se afirma "sin plagio" si aún no hay qué comparar
  let tone: "idle" | "ok" | "alert" = "idle";
  let title = "Se activa con los primeros proyectos";
  let text = "Cuando los equipos registren y describan sus proyectos, aquí verás si alguno se parece a otro de este u otros años.";
  if (analysis.loading) {
    title = "Analizando…";
    text = "Comparando con el historial de proyectos.";
  } else if (projects.length && !ready.length) {
    title = "Esperando información";
    text = `${projects.length} proyecto(s) registrado(s), pero aún con muy poco texto o sin entregas para compararlos con confianza.`;
  } else if (flagged.length) {
    tone = "alert";
    title = `${flagged.length} proyecto(s) para revisar`;
    text = `Con similitud media o alta. ${ready.length} analizado(s)${thin ? `, ${thin} con poca información` : ""}.`;
  } else if (ready.length) {
    tone = "ok";
    title = "Sin coincidencias relevantes";
    text = `${ready.length} proyecto(s) analizado(s)${thin ? `, ${thin} con poca información todavía` : ""}.`;
  }

  return (
    <div className="rounded-3xl bg-night p-5 text-white">
      <button onClick={() => onGo("projects")} className="flex w-full items-start gap-4 text-left">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl",
            tone === "alert" ? "bg-amber-400 text-coal" : tone === "ok" ? "bg-lime text-coal" : "bg-white/10 text-white",
          )}
        >
          {tone === "alert" ? <AlertTriangle className="size-5" /> : tone === "ok" ? <ShieldCheck className="size-5" /> : <ScanSearch className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-white/75">Originalidad</span>
          <span className="mt-0.5 block font-display font-bold">{title}</span>
          <span className="mt-1 block font-mono text-[11px] leading-relaxed text-white/75">{text}</span>
        </span>
        <ArrowUpRight className="size-5 shrink-0" />
      </button>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/75">
          <EyeOff className="size-3.5" /> Visible solo para organizadores y administradores
        </span>
      </div>
    </div>
  );
}

function OriginalitySettingsCard() {
  return (
    <Card className="h-fit">
      <SectionTitle
        title="Originalidad"
        subtitle="Solo los organizadores y administradores ven el análisis de originalidad."
      />
      <p className="font-mono text-[11px] leading-relaxed text-muted">
        El análisis de similitud contra el historial de proyectos es de uso interno para organización y administración; no se muestra a jueces ni a participantes.
      </p>
    </Card>
  );
}

/* ---------- Proyectos ---------- */

function ProjectsTab({
  event,
  projects,
  evaluations,
  analysis,
  onReload,
}: {
  event: EventDoc;
  projects: ProjectDoc[];
  evaluations: EvaluationDoc[];
  analysis: Analysis;
  onReload: () => void;
}) {
  const { user } = useAuth();
  const canAssignStand = event.organizerEmails.includes(normalizeEmail(user?.email ?? ""));
  const [standProject, setStandProject] = useState<ProjectDoc | null>(null);
  const [sort, setSort] = useState<"name" | "similarity">("similarity");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "prototype" | "final" | "none">("all");
  const { top: topMatch, loading: loadingFp } = analysis;

  const categories = useMemo(() => {
    const set = new Set<string>(eventCategories(event));
    for (const p of projects) if (p.category) set.add(p.category);
    return Array.from(set);
  }, [event, projects]);

  const q = search.trim().toLowerCase();
  const filtered = projects.filter((p) => {
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (statusFilter === "prototype" && !p.prototype) return false;
    if (statusFilter === "final" && !p.final) return false;
    if (statusFilter === "none" && PHASES.some((phase) => event.phases[phase] && p[phase])) return false;
    if (!q) return true;
    const inTitle = p.title.toLowerCase().includes(q);
    const inSummary = p.summary.toLowerCase().includes(q);
    const inCat = p.category.toLowerCase().includes(q);
    const inTech = p.technologies.some((t) => t.toLowerCase().includes(q));
    const inMembers = p.members.some((m) => m.name.toLowerCase().includes(q) || displayEmail(m.email).toLowerCase().includes(q));
    return inTitle || inSummary || inCat || inTech || inMembers || Boolean(p.stand?.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) =>
    sort === "name" ? a.title.localeCompare(b.title) : (topMatch.get(b.id)?.score ?? 0) - (topMatch.get(a.id)?.score ?? 0),
  );

  function exportProjectsCsv() {
    const phases = PHASES.filter((phase) => event.phases[phase]);
    const headers = [
      "Proyecto",
      "Categoría",
      "Resumen",
      "Tecnologías",
      "Líder",
      "Correo líder",
      "Integrantes",
      "Correos integrantes",
      ...phases.flatMap((phase) => [`Entrega: ${getPhaseLabel(event, phase)}`, `Enlaces: ${getPhaseLabel(event, phase)}`]),
      "Evaluaciones",
      "Promedio",
      "Similitud máx. (%)",
      "Coincidencia principal",
    ];
    const rows = sorted.map((p) => {
      const evs = evaluations.filter((e) => e.projectId === p.id);
      const avg = evs.length
        ? (evs.reduce((s, e) => s + effectiveEvaluationTotal(getCategoryCriteria(event, p.category), e), 0) / evs.length).toFixed(1)
        : "";
      const match = topMatch.get(p.id);
      const leaderName = p.members.find((m) => m.email === p.leaderEmail)?.name ?? "";
      return [
        p.title,
        p.category,
        p.summary,
        p.technologies.join(", "),
        leaderName,
        displayEmail(p.leaderEmail),
        p.members.map((m) => m.name || displayEmail(m.email)).join("; "),
        p.members.map((m) => displayEmail(m.email)).join("; "),
        ...phases.flatMap((phase) => [p[phase] ? "Sí" : "No", (p[phase]?.links ?? []).map((l) => l.url).join("; ")]),
        evs.length,
        avg,
        match ? match.score : "",
        match ? `${match.other.title} (${match.other.eventName}, ${match.other.year})` : "",
      ];
    });
    downloadCsv(`proyectos_${event.code}.csv`, headers, rows);
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: "similarity", label: "Por similitud" },
            { id: "name", label: "Por nombre" },
          ]}
          value={sort}
          onChange={setSort}
        />
        <div className="flex flex-wrap gap-2">
          <TeamEnrollmentButton event={event} />
          <Button variant="outline" size="sm" onClick={exportProjectsCsv}>
            <Download className="size-3.5" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onReload} loading={loadingFp}>
            <RefreshCw className="size-3.5" /> Recalcular originalidad
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            aria-label="Buscar proyecto o integrante"
            placeholder="Buscar proyecto, integrante o tecnología"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface pl-9"
          />
        </div>
        <select
          aria-label="Filtrar por categoría"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-11 w-full rounded-xl border border-control bg-surface px-3 font-mono text-base text-ink sm:text-xs outline-none focus:border-ink/40"
        >
          <option value="all">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por estado de entrega"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-11 w-full rounded-xl border border-control bg-surface px-3 font-mono text-base text-ink sm:text-xs outline-none focus:border-ink/40"
        >
          <option value="all">Todas las entregas</option>
          {PHASES.filter((phase) => event.phases[phase]).map((phase) => {
            const label = getPhaseLabel(event, phase);
            return (
              <option key={phase} value={phase}>
                {label.toLowerCase() === "entrega" ? "Con entrega" : `Con entrega: ${label}`}
              </option>
            );
          })}
          <option value="none">Sin entregas</option>
        </select>
      </div>

      {sorted.length ? (
        <ul className="space-y-3">
          {sorted.map((p) => {
            const evs = evaluations.filter((e) => e.projectId === p.id);
            const avg = evs.length ? evs.reduce((s, e) => s + effectiveEvaluationTotal(getCategoryCriteria(event, p.category), e), 0) / evs.length : null;
            const match = topMatch.get(p.id);
            return (
              <li key={p.id}>
                <Link
                  href={`/eventos/${event.id}/proyectos/${p.id}`}
                  className="grid gap-3 ui-panel ui-interactive rounded-3xl p-5 transition hover:-translate-y-0.5 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold">{p.title || displayEmail(p.leaderEmail)}</h3>
                      {p.registrationPending && <Badge>Registro pendiente del líder</Badge>}
                      {p.category && <Badge>{p.category}</Badge>}
                      <Badge>{p.stand ? `Stand: ${p.stand}` : "Sin stand asignado"}</Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {p.members.length} integrante(s) · {p.members.map((m) => m.name || displayEmail(m.email)).join(", ")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <SubmissionBadges project={p} event={event} />
                      {!loadingFp && <SimilarityBadge match={match} state={analysis.state.get(p.id)} />}
                    </div>
                    {match && (match.level === "alto" || match.level === "medio") && (
                      <p className="mt-2 font-mono text-[11px] text-muted">
                        Se parece a «{match.other.title}» ({match.other.eventName}, {match.other.year})
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                    <p className="font-display text-2xl font-bold tabular-nums">{avg !== null ? avg.toFixed(1) : "—"}</p>
                    <p className="font-mono text-[10px] text-muted">{evs.length} evaluación(es)</p>
                  </div>
                </Link>
                {canAssignStand && (
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setStandProject(p)}
                      aria-label={`${p.stand ? "Cambiar" : "Asignar"} stand de ${p.title || displayEmail(p.leaderEmail)}`}>
                      <MapPin className="size-3.5" /> {p.stand ? "Cambiar stand" : "Asignar stand"}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={!projects.length ? <Users className="size-5" /> : undefined}
          title={projects.length ? "Sin coincidencias" : "Aún no hay proyectos"}
          text={projects.length ? "Prueba con otra búsqueda o cambia los filtros." : "Da de alta el correo del alumno líder. Él completará su proyecto y agregará a sus integrantes al entrar."} />
      )}
      <Modal open={canAssignStand && !!standProject} onClose={() => setStandProject(null)} title="Ubicación del stand">
        {standProject && <StandForm key={standProject.id} project={standProject} onClose={() => setStandProject(null)} />}
      </Modal>
    </div>
  );
}

function StandForm({ project, onClose }: { project: ProjectDoc; onClose: () => void }) {
  const [stand, setStand] = useState(project.stand ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (saving) return;
      setSaving(true);
      setError("");
      try {
        await saveProjectStand(project.eventId, project.id, stand);
        toast(stand.trim() ? "Stand guardado." : "Stand retirado.");
        onClose();
      } catch (err) {
        setError(firestoreErrorMessage(err));
      } finally {
        setSaving(false);
      }
    }}>
      <p className="font-medium">{project.title || displayEmail(project.leaderEmail)}</p>
      <Field label="Stand y ubicación" htmlFor="project-stand"
        hint="Escribe el identificador y la zona si hace falta. Deja el campo vacío para retirar la asignación.">
        <Input id="project-stand" value={stand} maxLength={80} disabled={saving}
          onChange={(e) => setStand(e.target.value)} placeholder="Ej. A-12 · Pasillo central" />
      </Field>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>Guardar stand</Button>
      </div>
    </form>
  );
}

/* ---------- Jueces y organizadores ---------- */

function JudgesTab({ event, projects }: { event: EventDoc; projects: ProjectDoc[] }) {
  const toast = useToast();
  const ownerEmail = event.ownerEmail;
  const [editingJudge, setEditingJudge] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
      <EmailListEditor
        title="Jueces"
        subtitle="Califican sus proyectos asignados. No pueden organizar ni formar parte de un equipo de este evento."
        emails={event.judgeEmails}
        invitation={{ kind: "event", eventId: event.id, role: "judge" }}
        onSave={(judgeEmails) => saveEventEmails(event, "judgeEmails", judgeEmails)}
      />
      <EmailListEditor
        title="Organizadores"
        subtitle="Administran el evento. No pueden calificar ni concursar en él."
        emails={event.organizerEmails}
        invitation={{ kind: "event", eventId: event.id, role: "organizer" }}
        locked={[ownerEmail]}
        onSave={(organizerEmails) => saveEventEmails(event, "organizerEmails", organizerEmails)}
      />

      <ProjectJudgeAssignments event={event} projects={projects} />

      {event.judgeEmails.length > 0 && (
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Horarios de los jueces"
            subtitle="Opcional. Indica en qué horario califica cada juez los proyectos que ya tiene asignados. Para asignar o quitar proyectos usa «Asignación por proyecto»."
          />
          {!event.judgingOpen && !event.resultsPublished && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
              <p className="font-mono text-xs leading-relaxed">
                La evaluación de jueces está cerrada. Aunque asignes un horario, los jueces verán sus proyectos bloqueados hasta que abras la evaluación.
              </p>
              <Button
                variant="dark"
                size="sm"
                disabled={event.accessVersion !== 1}
                onClick={async () => {
                  try {
                    await updateEvent(event.id, { judgingOpen: true });
                    toast("Evaluación de jueces abierta.");
                  } catch (err) {
                    toast(firestoreErrorMessage(err), "error");
                  }
                }}
              >
                Abrir evaluación ahora
              </Button>
            </div>
          )}
          <ul className="divide-y divide-line">
            {event.judgeEmails.map((email) => {
              const key = normalizeEmail(email);
              const assigned = projects.filter((p) => isProjectAssignedToJudge(event, p, key));
              const slots = event.judgeAssignments?.[key]?.schedule ?? {};
              const scheduled = assigned.filter((p) => slots[p.id]?.startsAt && slots[p.id]?.endsAt).length;
              const legacy = hasJudgeAssignment(event, key);
              return (
                <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-medium">{displayEmail(key)}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={assigned.length ? "lime" : undefined}>{assigned.length} proyecto(s) asignado(s)</Badge>
                      {assigned.length > 0 && <Badge>{scheduled} de {assigned.length} con horario</Badge>}
                    </div>
                    {!assigned.length && (
                      <p className="mt-1 text-xs text-muted">Asígnale proyectos en «Asignación por proyecto» para programar su horario.</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" disabled={!assigned.length && !legacy} onClick={() => setEditingJudge(key)}>
                    <CalendarClock className="size-3.5" /> Programar horario
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="flex items-start gap-3 rounded-3xl bg-lime p-5 lg:col-span-2">
        <Gavel className="mt-0.5 size-5 shrink-0" />
        <p className="font-mono text-[11px] leading-relaxed">
          Los jueces no necesitan código: al iniciar sesión con el correo que agregaste, el evento aparece en su panel en
          «Para evaluar». Cada juez solo ve sus propias calificaciones.
        </p>
      </div>

      <Modal open={!!editingJudge} onClose={() => setEditingJudge(null)} title="Horario de calificación">
        {editingJudge && (
          <JudgeScheduleModal
            event={event}
            judgeEmail={editingJudge}
            projects={projects}
            initial={event.judgeAssignments?.[editingJudge]}
            onClose={() => setEditingJudge(null)}
            onSave={async (assignment) => {
              try {
                await saveJudgeAssignment(event.id, editingJudge, assignment);
                toast("Horario guardado.");
                setEditingJudge(null);
              } catch (err) {
                toast(firestoreErrorMessage(err), "error");
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}

/** Programa horarios solo para los proyectos que el juez ya tiene asignados. */
function JudgeScheduleModal({
  event,
  judgeEmail,
  projects,
  initial,
  onSave,
  onClose,
}: {
  event: EventDoc;
  judgeEmail: string;
  projects: ProjectDoc[];
  initial?: JudgeAssignment;
  onSave: (assignment: JudgeAssignment) => Promise<void>;
  onClose: () => void;
}) {
  const [schedule, setSchedule] = useState<NonNullable<JudgeAssignment["schedule"]>>(initial?.schedule ?? {});
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // Asignaciones creadas con la versión anterior (por categoría o proyecto desde este panel).
  const legacyCats = initial?.categories ?? [];
  const legacyProjs = initial?.projectIds ?? [];
  const hasLegacy = legacyCats.length > 0 || legacyProjs.length > 0;
  const [clearLegacy, setClearLegacy] = useState(false);
  const draftEvent = clearLegacy
    ? { ...event, judgeAssignments: { ...event.judgeAssignments, [judgeEmail]: { categories: [], projectIds: [] } } }
    : event;
  const assigned = projects.filter((p) => isProjectAssignedToJudge(draftEvent, p, judgeEmail));

  function changeTime(projectId: string, field: "startsAt" | "endsAt", raw: string) {
    const iso = scheduleInputToIso(raw);
    if (raw && !iso) { setScheduleMessage("Revisa la fecha y hora del turno."); return; }
    setScheduleMessage("");
    setSchedule((prev) => ({ ...prev, [projectId]: { startsAt: prev[projectId]?.startsAt ?? "", endsAt: prev[projectId]?.endsAt ?? "",
      [field]: iso } }));
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs font-medium">{displayEmail(judgeEmail)}</p>
        <p className="mt-1 text-sm text-muted">
          {assigned.length
            ? `Tiene ${assigned.length} proyecto(s) asignado(s). Indica inicio y fin para cada uno (hora de Culiacán). Puedes dejar alguno sin horario.`
            : "Este juez no tiene proyectos asignados. Asígnalos primero en «Asignación por proyecto»."}
        </p>
      </div>

      {hasLegacy && !clearLegacy && (
        <div className="space-y-2 rounded-2xl bg-amber-50 p-4 text-amber-900">
          <p className="text-xs leading-relaxed">
            Este juez tiene una asignación anterior
            {legacyCats.length > 0 && <> por categoría (<strong>{legacyCats.join(", ")}</strong>)</>}
            {legacyCats.length > 0 && legacyProjs.length > 0 && " y"}
            {legacyProjs.length > 0 && <> de {legacyProjs.length} proyecto(s) individual(es)</>}
            . Por eso recibe proyectos que no elegiste en «Asignación por proyecto».
          </p>
          <Button variant="outline" size="sm" onClick={() => setClearLegacy(true)}>Quitar asignación anterior</Button>
        </div>
      )}
      {clearLegacy && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper p-4 text-xs">
          <span>Al guardar, el juez solo conservará los proyectos elegidos en «Asignación por proyecto».</span>
          <button type="button" className="font-mono underline" onClick={() => setClearLegacy(false)}>Deshacer</button>
        </div>
      )}

      {assigned.length > 0 && (
        <ul className="space-y-3">
          {assigned.map((p) => (
            <li key={p.id} className="space-y-2 rounded-xl bg-paper p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{p.title}</p>
                {p.category && <Badge>{p.category}</Badge>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Inicio" htmlFor={`start-${p.id}`}>
                  <Input id={`start-${p.id}`} type="datetime-local" value={scheduleInputValue(schedule[p.id]?.startsAt)}
                    onChange={(e) => changeTime(p.id, "startsAt", e.target.value)} />
                </Field>
                <Field label="Fin" htmlFor={`end-${p.id}`}>
                  <Input id={`end-${p.id}`} type="datetime-local" value={scheduleInputValue(schedule[p.id]?.endsAt)}
                    onChange={(e) => changeTime(p.id, "endsAt", e.target.value)} />
                </Field>
              </div>
              <p className="text-xs text-muted">{scheduleLabel(schedule[p.id])}</p>
            </li>
          ))}
        </ul>
      )}
      {scheduleMessage && <p role="alert" className="text-sm text-red-700">{scheduleMessage}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          loading={busy}
          disabled={!assigned.length && !clearLegacy}
          onClick={async () => {
            setBusy(true);
            try {
              const activeSchedule = Object.fromEntries(Object.entries(schedule).filter(([id, slot]) => assigned.some((p) => p.id === id) && (slot.startsAt || slot.endsAt)));
              const error = scheduleError(activeSchedule);
              if (error) { setScheduleMessage(error); return; }
              await onSave({
                categories: clearLegacy ? [] : legacyCats,
                projectIds: clearLegacy ? [] : legacyProjs,
                schedule: activeSchedule,
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar horario
        </Button>
      </div>
    </div>
  );
}

/* ---------- Rúbrica ---------- */

function RubricTab({ event, projects, hasEvaluations }: { event: EventDoc; projects: ProjectDoc[]; hasEvaluations: boolean }) {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, Criterion[]>>({});
  const categories = [...new Set([...eventCategories(event), ...projects.map((p) => p.category).filter(Boolean)])];

  return (
    <Card>
      <SectionTitle title="Rúbricas por categoría"
        subtitle="Selecciona la categoría y guarda sus propios criterios. El juez recibirá automáticamente la rúbrica de la categoría del proyecto; cada total se normaliza a 100." />
      {hasEvaluations && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 font-mono text-[11px] text-amber-800">
          Ya hay evaluaciones. Cambiar pesos o quitar criterios recalcula los promedios de esa categoría. Si agregas criterios,
          avisa a sus jueces para que completen la evaluación.
        </p>
      )}
      {event.resultsPublished && <p className="mb-4 font-mono text-xs text-muted">Oculta los resultados antes de cambiar una rúbrica.</p>}
      <CategoryCriteriaEditor categories={categories} rubrics={{ ...event.categoryCriteria, ...drafts }} fallbackCriteria={event.criteria}
        disabled={event.resultsPublished}
        onChange={(category, criteria) => setDrafts((prev) => ({ ...prev, [category]: criteria }))}
        onSave={async (category, criteria) => {
          const error = criteriaError(criteria);
          if (error) return toast(error, "error");
          try {
            await saveCategoryCriteria(event.id, category, criteria);
            toast(`Rúbrica de ${category} guardada.`);
          } catch (err) {
            toast(firestoreErrorMessage(err), "error");
          }
        }} />
    </Card>
  );
}

/* ---------- Resultados ---------- */

function ResultsTab({ event, projects, evaluations }: { event: EventDoc; projects: ProjectDoc[]; evaluations: EvaluationDoc[] }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const standings = computeStandings(event, projects, evaluations);
  const phases = PHASES.filter((p) => event.phases[p]);

  const resultCategories = useMemo(() => {
    const set = new Set<string>();
    for (const ph of phases) {
      for (const s of standings[ph]) if (s.category) set.add(s.category);
    }
    return Array.from(set);
  }, [phases, standings]);

  function exportResultsCsv() {
    const rubricColumns = resultRubricColumns(event, projects);
    const criterionHeaders = rubricColumns.map(({ category, criterion }) => `${category}: ${criterion.name} (0-10)`);
    const headers = [
      "Etapa",
      "Lugar general",
      "Lugar categoría",
      "Proyecto",
      "Categoría",
      "Integrantes",
      "Correos",
      "Jueces que evaluaron",
      ...criterionHeaders,
      "Puntaje final (0-100)",
      "Comentarios",
    ];
    const rows: Array<Array<string | number>> = [];
    for (const ph of phases) {
      const catCounts = new Map<string, number>();
      standings[ph].forEach((s, idx) => {
        const proj = projects.find((p) => p.id === s.projectId);
        const cat = s.category ?? proj?.category ?? "";
        const catRank = (catCounts.get(cat) ?? 0) + 1;
        catCounts.set(cat, catRank);
        rows.push([
          getPhaseLabel(event, ph),
          idx + 1,
          cat ? catRank : "",
          s.title,
          cat,
          proj ? proj.members.map((m) => m.name || displayEmail(m.email)).join("; ") : "",
          proj ? proj.members.map((m) => displayEmail(m.email)).join("; ") : "",
          s.judges,
          ...rubricColumns.map(({ category, criterion }) => category === cat ? s.criteria[criterion.id] ?? "" : ""),
          s.score,
          s.comments.join(" | "),
        ]);
      });
    }
    downloadCsv(`resultados_${event.code}.csv`, headers, rows);
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">
            {event.resultsPublished ? "Resultados publicados" : "Vista previa en vivo"}
          </h2>
          <p className="mt-1 max-w-lg font-mono text-[11px] text-muted">
            Promedio de los jueces por etapa. Al publicar, se cierra la evaluación y cada equipo ve su lugar, puntaje y
            comentarios (anónimos).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {evaluations.length > 0 && (
            <Button variant="outline" onClick={exportResultsCsv}>
              <Download className="size-4" /> Exportar CSV
            </Button>
          )}
          {event.resultsPublished ? (
            <>
              <Button variant="outline" onClick={() => setConfirm(true)}>
                <RefreshCw className="size-4" /> Actualizar
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await unpublishResults(event.id).catch((e) => toast(firestoreErrorMessage(e), "error"));
                }}
              >
                <EyeOff className="size-4" /> Ocultar
              </Button>
            </>
          ) : (
            <Button variant="dark" onClick={() => setConfirm(true)} disabled={!evaluations.length}>
              <Megaphone className="size-4" /> Publicar resultados
            </Button>
          )}
        </div>
      </Card>

      {resultCategories.length > 1 && (
        <Tabs
          tabs={[
            { id: "all", label: "General" },
            ...resultCategories.map((c) => ({ id: c, label: c })),
          ]}
          value={categoryFilter}
          onChange={setCategoryFilter}
        />
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
        {phases.map((ph) => {
          const rows =
            categoryFilter === "all"
              ? standings[ph]
              : standings[ph].filter((r) => r.category === categoryFilter);
          return (
            <Card key={ph}>
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
                <Trophy className="size-5" /> {getPhaseLabel(event, ph)}
                {categoryFilter !== "all" && <Badge>{categoryFilter}</Badge>}
              </h3>
              <Leaderboard rows={rows} eventId={event.id} linkable />
            </Card>
          );
        })}
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="¿Publicar resultados?">
        <p className="font-mono text-xs leading-relaxed text-muted">
          Se cerrará la evaluación de jueces y todos los participantes verán el ranking. Cada equipo verá su puntaje por
          criterio y los comentarios de los jueces sin sus nombres. Puedes ocultarlos después.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancelar
          </Button>
          <Button
            variant="dark"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await publishResults(event, projects, evaluations);
                toast("Resultados publicados.");
                setConfirm(false);
              } catch (err) {
                toast(firestoreErrorMessage(err), "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Publicar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- Ajustes ---------- */

function SettingsTab({ event }: { event: EventDoc }) {
  const { user } = useAuth();
  const access = useAccess();
  const router = useRouter();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDeleteEvent = access.isSuperadmin || (Boolean(user?.uid) && user?.uid === event.ownerId);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Card>
        <SectionTitle title="Datos del evento" />
        <EventSettingsForm
          initial={event}
          submitLabel="Guardar cambios"
          onSubmit={async (input) => {
            const submissions = Object.fromEntries(
              PHASES.map((p) => [p, input.phases[p] ? event.submissions[p] : false]),
            ) as Record<Phase, boolean>;
            await updateEvent(event.id, { ...input, submissions });
            toast("Evento actualizado.");
          }}
        />
      </Card>
      <div className="space-y-4">
        <OriginalitySettingsCard />
        <Card className="h-fit">
          <SectionTitle title="Código" subtitle="Genera uno nuevo si el actual se compartió donde no debía." />
          <Field label="Código actual" htmlFor="event-code">
            <Input id="event-code" readOnly value={event.code} className="font-mono tracking-[0.3em]" />
          </Field>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={async () => {
              try {
                const code = await generateUniqueEventCode();
                await updateEvent(event.id, { code });
                toast("Código actualizado.");
              } catch (e) {
                toast(firestoreErrorMessage(e), "error");
              }
            }}
          >
            <RefreshCw className="size-3.5" /> Nuevo código
          </Button>
        </Card>

        {canDeleteEvent && (
          <Card className="h-fit border border-red-200/70">
            <SectionTitle
              title="Eliminar evento"
              subtitle="Borra este evento junto con todos sus proyectos y calificaciones."
            />
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-3.5" /> Eliminar evento
            </Button>
          </Card>
        )}
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="¿Eliminar evento?">
        <p className="font-mono text-xs leading-relaxed text-muted">
          Se eliminará «{event.name}» junto con todos sus proyectos y evaluaciones. También se eliminarán el perfil y el acceso de los alumnos que no participen ni tengan permisos en otros eventos. Esta acción no se puede deshacer.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                await deleteEvent(event.id);
                toast("Evento eliminado.");
                router.push("/panel");
              } catch (err) {
                toast(firestoreErrorMessage(err), "error");
                setDeleting(false);
              }
            }}
          >
            Eliminar definitivamente
          </Button>
        </div>
      </Modal>
    </div>
  );
}
