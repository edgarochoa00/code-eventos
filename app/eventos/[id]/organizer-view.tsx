"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  EyeOff,
  Gavel,
  Megaphone,
  Plus,
  RefreshCw,
  ScanSearch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmailListEditor } from "@/components/email-list-editor";
import { EventSettingsForm } from "@/components/event-settings-form";
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
  Segmented,
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
  saveCriteria,
  unpublishResults,
  updateEvent,
} from "@/lib/data";
import { useCollection, useFingerprints } from "@/lib/hooks";
import { analysisState, findMatches, type AnalysisState } from "@/lib/similarity";
import {
  PHASE_LABEL,
  PHASES,
  type Criterion,
  type EvaluationDoc,
  type EventDoc,
  type JudgeAssignment,
  type JudgeOriginality,
  type OriginalitySettings,
  type Phase,
  type ProjectDoc,
  type TeamOriginality,
} from "@/lib/types";
import {
  cn,
  downloadCsv,
  effectiveEvaluationTotal,
  eventCategories,
  formatDate,
  hasJudgeAssignment,
  isProjectAssignedToJudge,
  normalizeEmail,
  originalitySettings,
  randomId,
  todayISO,
} from "@/lib/utils";

type Tab = "summary" | "projects" | "judges" | "rubric" | "results" | "settings";

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
          { id: "rubric", label: "Rúbrica" },
          { id: "results", label: "Resultados" },
          { id: "settings", label: "Ajustes" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {(projects.error || evaluations.error) && <ErrorNote code={projects.error ?? evaluations.error ?? ""} />}

      {tab === "summary" && (
        <Summary event={event} projects={projects.data} evaluations={evaluations.data} analysis={analysis} onGo={setTab} />
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
      {tab === "judges" && <JudgesTab event={event} evaluations={evaluations.data} projects={projects.data} />}
      {tab === "rubric" && <RubricTab event={event} hasEvaluations={evaluations.data.length > 0} />}
      {tab === "results" && <ResultsTab event={event} projects={projects.data} evaluations={evaluations.data} />}
      {tab === "settings" && <SettingsTab event={event} />}
    </div>
  );
}

/* ---------- Resumen y etapas ---------- */

function Summary({
  event,
  projects,
  evaluations,
  analysis,
  onGo,
}: {
  event: EventDoc;
  projects: ProjectDoc[];
  evaluations: EvaluationDoc[];
  analysis: Analysis;
  onGo: (t: Tab) => void;
}) {
  const toast = useToast();
  const phases = PHASES.filter((p) => event.phases[p]);
  const expected = event.judgeEmails.reduce(
    (sum, email) =>
      sum +
      phases.reduce(
        (s, ph) => s + projects.filter((p) => p[ph] && isProjectAssignedToJudge(event, p, email)).length,
        0,
      ),
    0,
  );

  async function toggle(patch: Partial<EventDoc>) {
    try {
      await updateEvent(event.id, patch);
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
    }
  }

  const stats = [
    { label: "Proyectos", value: projects.length },
    ...phases.map((ph) => ({ label: `${PHASE_LABEL[ph]}s entregados`, value: projects.filter((p) => p[ph]).length })),
    { label: "Evaluaciones", value: `${evaluations.length}${expected ? `/${expected}` : ""}` },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <SectionTitle title="Etapas" subtitle="Abre y cierra cada etapa cuando quieras. Los cambios son inmediatos." />
        <div className="divide-y divide-ink/5">
          <Toggle
            label="Registro de proyectos"
            description="Los equipos pueden registrarse y editar su información."
            checked={event.registrationOpen}
            onChange={(v) => toggle({ registrationOpen: v })}
          />
          {phases.map((ph) => (
            <Toggle
              key={ph}
              label={`Entregas de ${PHASE_LABEL[ph].toLowerCase()}`}
              description="Los equipos pueden subir o actualizar esta entrega."
              checked={event.submissions[ph]}
              onChange={(v) => toggle({ submissions: { ...event.submissions, [ph]: v } })}
            />
          ))}
          <Toggle
            label="Evaluación de jueces"
            description={event.judgeEmails.length ? "Los jueces pueden calificar." : "Primero invita jueces."}
            checked={event.judgingOpen}
            onChange={(v) => toggle({ judgingOpen: v })}
          />
        </div>
      </Card>

      <div className="space-y-4">
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-3xl bg-surface p-5">
              <p className="font-display text-3xl font-bold tabular-nums">{s.value}</p>
              <p className="mt-1 font-mono text-[11px] text-ink/55">{s.label}</p>
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

function teamVisibilityText(event: EventDoc) {
  const o = originalitySettings(event);
  if (o.teams === "results") return "Los equipos lo verán al publicar resultados";
  if (o.teams === "date") return o.teamsFrom ? `Los equipos lo verán desde el ${formatDate(o.teamsFrom)}` : "Falta elegir la fecha";
  return "Los equipos no lo ven";
}

function OriginalityCard({
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
          <span className="block font-mono text-[10px] uppercase tracking-wider text-white/50">Originalidad</span>
          <span className="mt-0.5 block font-display font-bold">{title}</span>
          <span className="mt-1 block font-mono text-[11px] leading-relaxed text-white/60">{text}</span>
        </span>
        <ArrowUpRight className="size-5 shrink-0" />
      </button>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/60">
          <EyeOff className="size-3.5" /> {teamVisibilityText(event)}
        </span>
        <button onClick={() => onGo("settings")} className="font-mono text-[10px] text-lime underline underline-offset-2">
          Cambiar
        </button>
      </div>
    </div>
  );
}

function OriginalitySettingsCard({ event }: { event: EventDoc }) {
  const toast = useToast();
  const o = originalitySettings(event);

  async function save(patch: Partial<OriginalitySettings>) {
    try {
      await updateEvent(event.id, { originality: { ...o, ...patch } });
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
    }
  }

  return (
    <Card className="h-fit">
      <SectionTitle
        title="Originalidad"
        subtitle="Tú y los demás organizadores siempre ven el análisis. Decide cuándo lo ven los demás."
      />
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">Jueces</p>
          <Segmented<JudgeOriginality>
            label="Cuándo ven los jueces la originalidad"
            value={o.judges}
            onChange={(judges) => save({ judges })}
            options={[
              { id: "always", label: "Siempre" },
              { id: "judging", label: "Al abrir la evaluación" },
            ]}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Cada equipo (solo su proyecto)</p>
          <Segmented<TeamOriginality>
            label="Cuándo ve cada equipo su originalidad"
            value={o.teams}
            onChange={(teams) => save({ teams, teamsFrom: teams === "date" ? o.teamsFrom || todayISO() : o.teamsFrom })}
            options={[
              { id: "hidden", label: "Nunca" },
              { id: "results", label: "Al publicar resultados" },
              { id: "date", label: "Desde una fecha" },
            ]}
          />
          {o.teams === "date" && (
            <Field label="Fecha" htmlFor="orig-date">
              <Input
                id="orig-date"
                type="date"
                value={o.teamsFrom}
                onChange={(e) => e.target.value && save({ teamsFrom: e.target.value })}
              />
            </Field>
          )}
          <p className="font-mono text-[11px] leading-relaxed text-ink/55">
            Los equipos solo ven el porcentaje de su proyecto y el motivo. Nunca ven el nombre de los otros proyectos con
            los que coincide.
          </p>
        </div>
      </div>
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
    if (statusFilter === "none" && (p.prototype || p.final)) return false;
    if (!q) return true;
    const inTitle = p.title.toLowerCase().includes(q);
    const inSummary = p.summary.toLowerCase().includes(q);
    const inCat = p.category.toLowerCase().includes(q);
    const inTech = p.technologies.some((t) => t.toLowerCase().includes(q));
    const inMembers = p.members.some((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
    return inTitle || inSummary || inCat || inTech || inMembers;
  });

  const sorted = [...filtered].sort((a, b) =>
    sort === "name" ? a.title.localeCompare(b.title) : (topMatch.get(b.id)?.score ?? 0) - (topMatch.get(a.id)?.score ?? 0),
  );

  function exportProjectsCsv() {
    const headers = [
      "Proyecto",
      "Categoría",
      "Resumen",
      "Tecnologías",
      "Líder",
      "Correo líder",
      "Integrantes",
      "Correos integrantes",
      "Prototipo entregado",
      "Enlaces prototipo",
      "Producto final entregado",
      "Enlaces final",
      "Evaluaciones",
      "Promedio",
      "Similitud máx. (%)",
      "Coincidencia principal",
    ];
    const rows = sorted.map((p) => {
      const evs = evaluations.filter((e) => e.projectId === p.id);
      const avg = evs.length
        ? (evs.reduce((s, e) => s + effectiveEvaluationTotal(event.criteria, e), 0) / evs.length).toFixed(1)
        : "";
      const match = topMatch.get(p.id);
      const leaderName = p.members.find((m) => m.email === p.leaderEmail)?.name ?? "";
      return [
        p.title,
        p.category,
        p.summary,
        p.technologies.join(", "),
        leaderName,
        p.leaderEmail,
        p.members.map((m) => m.name || m.email).join("; "),
        p.members.map((m) => m.email).join("; "),
        p.prototype ? "Sí" : "No",
        (p.prototype?.links ?? []).map((l) => l.url).join("; "),
        p.final ? "Sí" : "No",
        (p.final?.links ?? []).map((l) => l.url).join("; "),
        evs.length,
        avg,
        match ? match.score : "",
        match ? `${match.other.title} (${match.other.eventName}, ${match.other.year})` : "",
      ];
    });
    downloadCsv(`proyectos_${event.code}.csv`, headers, rows);
  }

  if (!projects.length) {
    return (
      <EmptyState
        icon={<Users className="size-5" />}
        title="Aún no hay proyectos"
        text={`Comparte el código ${event.code} con los alumnos para que registren su proyecto.`}
      />
    );
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
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
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
          className="h-11 w-full rounded-xl border border-ink/10 bg-surface px-3 font-mono text-xs text-ink outline-none focus:border-ink/40"
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
          className="h-11 w-full rounded-xl border border-ink/10 bg-surface px-3 font-mono text-xs text-ink outline-none focus:border-ink/40"
        >
          <option value="all">Todas las entregas</option>
          {event.phases.prototype && <option value="prototype">Con prototipo</option>}
          {event.phases.final && <option value="final">Con producto final</option>}
          <option value="none">Sin entregas</option>
        </select>
      </div>

      {sorted.length ? (
        <ul className="space-y-3">
          {sorted.map((p) => {
            const evs = evaluations.filter((e) => e.projectId === p.id);
            const avg = evs.length ? evs.reduce((s, e) => s + effectiveEvaluationTotal(event.criteria, e), 0) / evs.length : null;
            const match = topMatch.get(p.id);
            return (
              <li key={p.id}>
                <Link
                  href={`/eventos/${event.id}/proyectos/${p.id}`}
                  className="grid gap-3 rounded-3xl bg-surface p-5 transition hover:-translate-y-0.5 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold">{p.title}</h3>
                      {p.category && <Badge>{p.category}</Badge>}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-ink/55">
                      {p.members.length} integrante(s) · {p.members.map((m) => m.name || m.email).join(", ")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <SubmissionBadges project={p} event={event} />
                      {!loadingFp && <SimilarityBadge match={match} state={analysis.state.get(p.id)} />}
                    </div>
                    {match && (match.level === "alto" || match.level === "medio") && (
                      <p className="mt-2 font-mono text-[11px] text-ink/70">
                        Se parece a «{match.other.title}» ({match.other.eventName}, {match.other.year})
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                    <p className="font-display text-2xl font-bold tabular-nums">{avg !== null ? avg.toFixed(1) : "—"}</p>
                    <p className="font-mono text-[10px] text-ink/50">{evs.length} evaluación(es)</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Sin coincidencias" text="Prueba con otra búsqueda o cambia los filtros." />
      )}
    </div>
  );
}

/* ---------- Jueces y organizadores ---------- */

function JudgesTab({ event, evaluations, projects }: { event: EventDoc; evaluations: EvaluationDoc[]; projects: ProjectDoc[] }) {
  const toast = useToast();
  const phases = PHASES.filter((p) => event.phases[p]);
  const ownerEmail = event.ownerEmail;
  const [editingJudge, setEditingJudge] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>(eventCategories(event));
    for (const p of projects) if (p.category) set.add(p.category);
    return Array.from(set);
  }, [event, projects]);

  function judgeTasksCount(email: string) {
    const assigned = projects.filter((p) => isProjectAssignedToJudge(event, p, email));
    return phases.reduce((s, ph) => s + assigned.filter((p) => p[ph]).length, 0);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
      <EmailListEditor
        title="Jueces"
        subtitle="Entran con este correo y verán los proyectos para calificar."
        emails={event.judgeEmails}
        onSave={(judgeEmails) => updateEvent(event.id, { judgeEmails })}
        progress={(email) => {
          const n = evaluations.filter((e) => e.judgeEmail === email).length;
          return `${n}/${judgeTasksCount(email)} evaluaciones`;
        }}
      />
      <EmailListEditor
        title="Organizadores"
        subtitle="Pueden administrar todo el evento, igual que tú."
        emails={event.organizerEmails}
        locked={[ownerEmail]}
        onSave={(organizerEmails) => updateEvent(event.id, { organizerEmails })}
      />

      {event.judgeEmails.length > 0 && (
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Asignación de jueces"
            subtitle="Por defecto cada juez evalúa todos los proyectos. Puedes limitar a un juez por categorías o proyectos específicos."
          />
          <ul className="divide-y divide-ink/5">
            {event.judgeEmails.map((email) => {
              const key = normalizeEmail(email);
              const hasCustom = hasJudgeAssignment(event, key);
              const a = event.judgeAssignments?.[key];
              const assignedCount = projects.filter((p) => isProjectAssignedToJudge(event, p, key)).length;
              return (
                <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-medium">{key}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {!hasCustom ? (
                        <Badge>Todos los proyectos ({projects.length})</Badge>
                      ) : (
                        <>
                          <Badge tone="lime">{assignedCount} proyecto(s) asignado(s)</Badge>
                          {(a?.categories ?? []).map((c) => (
                            <Badge key={c}>{c}</Badge>
                          ))}
                          {(a?.projectIds?.length ?? 0) > 0 && (
                            <Badge>{a!.projectIds!.length} proyecto(s) individual(es)</Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditingJudge(key)}>
                    <SlidersHorizontal className="size-3.5" /> Asignar
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

      <Modal open={!!editingJudge} onClose={() => setEditingJudge(null)} title="Asignar proyectos a juez">
        {editingJudge && (
          <JudgeAssignmentModal
            judgeEmail={editingJudge}
            categories={categories}
            projects={projects}
            initial={event.judgeAssignments?.[editingJudge]}
            onClose={() => setEditingJudge(null)}
            onSave={async (assignment) => {
              try {
                const next = { ...(event.judgeAssignments ?? {}) };
                if (!assignment.categories?.length && !assignment.projectIds?.length) {
                  delete next[editingJudge];
                } else {
                  next[editingJudge] = assignment;
                }
                await updateEvent(event.id, { judgeAssignments: next });
                toast("Asignación guardada.");
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

function JudgeAssignmentModal({
  judgeEmail,
  categories,
  projects,
  initial,
  onSave,
  onClose,
}: {
  judgeEmail: string;
  categories: string[];
  projects: ProjectDoc[];
  initial?: JudgeAssignment;
  onSave: (assignment: JudgeAssignment) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedCats, setSelectedCats] = useState<string[]>(initial?.categories ?? []);
  const [selectedProjs, setSelectedProjs] = useState<string[]>(initial?.projectIds ?? []);
  const [busy, setBusy] = useState(false);

  const isAll = selectedCats.length === 0 && selectedProjs.length === 0;

  function toggleCat(cat: string) {
    setSelectedCats((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  function toggleProj(id: string) {
    setSelectedProjs((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-xs font-medium">{judgeEmail}</p>
        <p className="mt-1 font-mono text-[11px] text-ink/60">
          {isAll
            ? "Actualmente evalúa todos los proyectos del evento."
            : "Solo verá como pendientes los proyectos de las categorías o proyectos que marques abajo."}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-medium text-ink/80">Por categoría</p>
          {!isAll && (
            <button
              type="button"
              onClick={() => {
                setSelectedCats([]);
                setSelectedProjs([]);
              }}
              className="font-mono text-[11px] text-ink/60 underline hover:text-ink"
            >
              Evaluar todos
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const active = selectedCats.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCat(cat)}
                className={cn(
                  "rounded-full px-3 py-1.5 font-mono text-xs transition",
                  active ? "bg-ink text-surface" : "bg-paper text-ink/70 hover:text-ink",
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {projects.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-xs font-medium text-ink/80">Proyectos específicos</p>
          <div className="max-h-52 divide-y divide-ink/5 overflow-y-auto rounded-2xl bg-paper px-3">
            {projects.map((p) => {
              const byCat = Boolean(p.category && selectedCats.includes(p.category));
              const checked = byCat || selectedProjs.includes(p.id);
              return (
                <Toggle
                  key={p.id}
                  label={p.title}
                  description={byCat ? `${p.category} (incluido por categoría)` : p.category}
                  checked={checked}
                  disabled={byCat}
                  onChange={() => toggleProj(p.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave({ categories: selectedCats, projectIds: selectedProjs });
            } finally {
              setBusy(false);
            }
          }}
        >
          Guardar asignación
        </Button>
      </div>
    </div>
  );
}

/* ---------- Rúbrica ---------- */

function RubricTab({ event, hasEvaluations }: { event: EventDoc; hasEvaluations: boolean }) {
  const toast = useToast();
  const [criteria, setCriteria] = useState<Criterion[]>(event.criteria);
  const [busy, setBusy] = useState(false);
  const total = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);

  function update(i: number, patch: Partial<Criterion>) {
    setCriteria((list) => list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  return (
    <Card>
      <SectionTitle
        title="Rúbrica"
        subtitle="Cada criterio se califica de 0 a 10. El peso define cuánto cuenta en el total de 100."
      />
      {hasEvaluations && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 font-mono text-[11px] text-amber-800">
          Ya hay evaluaciones. Si cambias los pesos o quitas un criterio, los promedios se recalculan automáticamente. Si
          agregas un criterio nuevo, avisa a los jueces para que lo califiquen.
        </p>
      )}
      <div className="space-y-3">
        {criteria.map((c, i) => (
          <div key={c.id} className="grid gap-2 rounded-2xl bg-paper p-3 sm:grid-cols-[1fr_1.5fr_90px_auto]">
            <Input aria-label="Criterio" value={c.name} onChange={(e) => update(i, { name: e.target.value })} className="bg-surface" />
            <Input
              aria-label="Descripción"
              value={c.description}
              onChange={(e) => update(i, { description: e.target.value })}
              className="bg-surface"
            />
            <Input
              aria-label="Peso"
              type="number"
              min={0}
              max={100}
              value={c.weight}
              onChange={(e) => update(i, { weight: Number(e.target.value) })}
              className="bg-surface"
            />
            <Button
              variant="ghost"
              aria-label={`Quitar ${c.name}`}
              onClick={() => setCriteria((l) => l.filter((_, idx) => idx !== i))}
              disabled={criteria.length <= 1}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCriteria((l) => [...l, { id: randomId("c"), name: "Nuevo criterio", description: "", weight: 10 }])}
        >
          <Plus className="size-4" /> Criterio
        </Button>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-xs ${total === 100 ? "text-ink/60" : "text-amber-700"}`}>
            Suma de pesos: {total}
            {total !== 100 && " (se normaliza a 100)"}
          </span>
          <Button
            loading={busy}
            onClick={async () => {
              if (criteria.some((c) => !c.name.trim())) return toast("Todos los criterios necesitan nombre.", "error");
              if (total <= 0) return toast("La suma de pesos debe ser mayor a 0.", "error");
              setBusy(true);
              try {
                await saveCriteria(event.id, criteria.map((c) => ({ ...c, name: c.name.trim(), weight: Number(c.weight) || 0 })));
                toast("Rúbrica guardada.");
              } catch (err) {
                toast(firestoreErrorMessage(err), "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Guardar rúbrica
          </Button>
        </div>
      </div>
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
    const criterionHeaders = event.criteria.map((c) => `${c.name} (0-10)`);
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
          PHASE_LABEL[ph],
          idx + 1,
          cat ? catRank : "",
          s.title,
          cat,
          proj ? proj.members.map((m) => m.name || m.email).join("; ") : "",
          proj ? proj.members.map((m) => m.email).join("; ") : "",
          s.judges,
          ...event.criteria.map((c) => s.criteria[c.id] ?? ""),
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
          <p className="mt-1 max-w-lg font-mono text-[11px] text-ink/60">
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
                <Trophy className="size-5" /> {PHASE_LABEL[ph]}
                {categoryFilter !== "all" && <Badge>{categoryFilter}</Badge>}
              </h3>
              <Leaderboard rows={rows} eventId={event.id} linkable />
            </Card>
          );
        })}
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="¿Publicar resultados?">
        <p className="font-mono text-xs leading-relaxed text-ink/70">
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
        <OriginalitySettingsCard event={event} />
        <Card className="h-fit">
          <SectionTitle title="Código" subtitle="Genera uno nuevo si el actual se compartió donde no debía." />
          <Field label="Código actual">
            <Input readOnly value={event.code} className="font-mono tracking-[0.3em]" />
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
        <p className="font-mono text-xs leading-relaxed text-ink/70">
          Se eliminará «{event.name}» junto con todos sus proyectos y evaluaciones. Esta acción no se puede deshacer.
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
