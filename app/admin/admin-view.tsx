"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Crown,
  FolderKanban,
  Gavel,
  Lock,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { EmailListEditor } from "@/components/email-list-editor";
import { EventStatus } from "@/components/event-card";
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
import { qAllEvents, qAllProjects, qAllStaff, qAllUsers, setEventMembership, setStaffRole, updateEvent } from "@/lib/data";
import { useCollection } from "@/lib/hooks";
import {
  GLOBAL_ROLE_LABEL,
  SUPERADMIN_EMAIL,
  type EventDoc,
  type GlobalRole,
  type ProjectDoc,
  type StaffDoc,
  type StaffRole,
  type UserDoc,
} from "@/lib/types";
import { cn, formatDate, initials, isEmail, normalizeEmail } from "@/lib/utils";

type Tab = "people" | "events" | "roles";
type Filter = "all" | "admins" | "organizers" | "judges" | "blocked" | "pending";

type Person = {
  email: string;
  user?: UserDoc;
  role: GlobalRole;
  judgeIn: EventDoc[];
  organizerIn: EventDoc[];
  projects: number;
};

const ROLE_HELP: Record<StaffRole | "user", string> = {
  user: "Puede registrar proyectos y evaluar si un organizador lo agrega como juez.",
  organizer: "Además puede crear sus propios eventos.",
  admin: "Administra todos los eventos, jueces y organizadores, y ve a todos los usuarios.",
  blocked: "No puede usar la app hasta que le quites la suspensión.",
};

const ROLE_TONE: Record<GlobalRole, "dark" | "lime" | "green" | "red" | "neutral"> = {
  superadmin: "dark",
  admin: "lime",
  organizer: "green",
  blocked: "red",
  user: "neutral",
};

export function AdminView() {
  const access = useAccess();
  const [tab, setTab] = useState<Tab>("people");

  const enabled = access.isAdmin;
  const users = useCollection<UserDoc>(enabled ? qAllUsers() : null, "admin:users");
  const staff = useCollection<StaffDoc>(enabled ? qAllStaff() : null, "admin:staff");
  const events = useCollection<EventDoc>(enabled ? qAllEvents() : null, "admin:events");
  const projects = useCollection<ProjectDoc>(enabled ? qAllProjects() : null, "admin:projects");

  // Une usuarios registrados, permisos y jueces/organizadores invitados (aunque no se hayan registrado)
  const people = useMemo<Person[]>(() => {
    const map = new Map<string, Person>();
    const get = (raw: string) => {
      const email = normalizeEmail(raw);
      if (!email) return null;
      let p = map.get(email);
      if (!p) {
        p = { email, role: email === SUPERADMIN_EMAIL ? "superadmin" : "user", judgeIn: [], organizerIn: [], projects: 0 };
        map.set(email, p);
      }
      return p;
    };
    get(SUPERADMIN_EMAIL);
    for (const u of users.data) {
      const p = get(u.email);
      if (p) p.user = u;
    }
    for (const s of staff.data) {
      const p = get(s.email);
      if (p && p.role !== "superadmin") p.role = s.role;
    }
    for (const e of events.data) {
      e.judgeEmails.forEach((m) => get(m)?.judgeIn.push(e));
      e.organizerEmails.forEach((m) => get(m)?.organizerIn.push(e));
    }
    for (const pr of projects.data) pr.memberEmails.forEach((m) => get(m) && get(m)!.projects++);
    return Array.from(map.values()).sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.email.localeCompare(b.email));
  }, [users.data, staff.data, events.data, projects.data]);

  if (access.loading) return <Spinner />;
  if (!access.isAdmin) {
    return (
      <EmptyState
        icon={<Lock className="size-5" />}
        title="Solo administradores"
        text="Esta sección es para el superadmin y los administradores de la plataforma."
        action={
          <Link href="/panel" className="font-mono text-xs underline">
            Volver al panel
          </Link>
        }
      />
    );
  }

  const loading = users.loading || staff.loading || events.loading || projects.loading;
  const error = users.error ?? staff.error ?? events.error ?? projects.error;
  const judgeCount = people.filter((p) => p.judgeIn.length).length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl bg-night p-6 text-white sm:p-8">
          <Badge tone="lime">
            {access.isSuperadmin ? <Crown className="size-3" /> : <ShieldCheck className="size-3" />}
            {GLOBAL_ROLE_LABEL[access.role]}
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Administración</h1>
          <p className="mt-2 max-w-md font-mono text-[11px] leading-relaxed text-white/60">
            {access.isSuperadmin
              ? "Controlas quién es admin u organizador, suspendes cuentas y asignas jueces en cualquier evento."
              : "Administras todos los eventos y sus jueces. Solo el superadmin cambia permisos de la plataforma."}
          </p>
        </div>
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
          <Stat icon={<Users className="size-4" />} label="Usuarios registrados" value={users.data.length} />
          <Stat icon={<CalendarDays className="size-4" />} label="Eventos" value={events.data.length} />
          <Stat icon={<FolderKanban className="size-4" />} label="Proyectos" value={projects.data.length} />
          <Stat icon={<Gavel className="size-4" />} label="Jueces" value={judgeCount} />
        </div>
      </section>

      <Tabs
        tabs={[
          { id: "people", label: "Usuarios", count: people.length },
          { id: "events", label: "Eventos", count: events.data.length },
          { id: "roles", label: "Permisos", count: staff.data.length + 1 },
        ]}
        value={tab}
        onChange={setTab}
      />
      {error && <ErrorNote code={error} />}

      {loading ? (
        <Spinner />
      ) : (
        <>
          {tab === "people" && <PeopleTab people={people} events={events.data} />}
          {tab === "events" && <EventsTab events={events.data} projects={projects.data} />}
          {tab === "roles" && <RolesTab people={people} />}
        </>
      )}
    </div>
  );
}

function roleOrder(role: GlobalRole) {
  return { superadmin: 0, admin: 1, organizer: 2, user: 3, blocked: 4 }[role];
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-surface p-5">
      <span className="text-ink/50">{icon}</span>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
      <p className="font-mono text-[11px] text-ink/55">{label}</p>
    </div>
  );
}

/* ---------- Usuarios ---------- */

function PeopleTab({ people, events }: { people: Person[]; events: EventDoc[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const counts: Record<Filter, number> = {
    all: people.length,
    admins: people.filter((p) => p.role === "superadmin" || p.role === "admin").length,
    organizers: people.filter((p) => p.role === "organizer" || p.organizerIn.length).length,
    judges: people.filter((p) => p.judgeIn.length).length,
    blocked: people.filter((p) => p.role === "blocked").length,
    pending: people.filter((p) => !p.user).length,
  };

  const q = search.trim().toLowerCase();
  const list = people
    .filter((p) => {
      if (filter === "admins") return p.role === "superadmin" || p.role === "admin";
      if (filter === "organizers") return p.role === "organizer" || p.organizerIn.length > 0;
      if (filter === "judges") return p.judgeIn.length > 0;
      if (filter === "blocked") return p.role === "blocked";
      if (filter === "pending") return !p.user;
      return true;
    })
    .filter((p) => !q || p.email.includes(q) || (p.user?.displayName ?? "").toLowerCase().includes(q));

  const current = people.find((p) => p.email === selected) ?? null;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
        <Input
          aria-label="Buscar usuario"
          placeholder="Buscar por nombre o correo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface pl-10"
        />
      </div>
      <Tabs
        tabs={[
          { id: "all", label: "Todos", count: counts.all },
          { id: "admins", label: "Admins", count: counts.admins },
          { id: "organizers", label: "Organizadores", count: counts.organizers },
          { id: "judges", label: "Jueces", count: counts.judges },
          { id: "blocked", label: "Suspendidos", count: counts.blocked },
          { id: "pending", label: "Sin registrarse", count: counts.pending },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {list.length ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          {list.map((p) => (
            <li key={p.email}>
              <button
                type="button"
                onClick={() => setSelected(p.email)}
                className="flex h-full w-full items-start gap-3 rounded-3xl bg-surface p-4 text-left transition hover:-translate-y-0.5 sm:p-5"
              >
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-full font-mono text-xs font-bold",
                    p.role === "blocked" ? "bg-red-100 text-red-700" : p.user ? "bg-lime text-coal" : "bg-ink/5 text-ink/50",
                  )}
                  aria-hidden
                >
                  {initials(p.user?.displayName || p.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.user?.displayName || "Sin nombre"}</span>
                  <span className="block truncate font-mono text-[11px] text-ink/55">{p.email}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={ROLE_TONE[p.role]}>
                      {p.role === "superadmin" && <Crown className="size-3" />}
                      {GLOBAL_ROLE_LABEL[p.role]}
                    </Badge>
                    {p.judgeIn.length > 0 && (
                      <Badge>
                        <Gavel className="size-3" /> Juez · {p.judgeIn.length}
                      </Badge>
                    )}
                    {p.organizerIn.length > 0 && <Badge>Organiza · {p.organizerIn.length}</Badge>}
                    {p.projects > 0 && <Badge>{p.projects} proyecto(s)</Badge>}
                    {!p.user && <Badge tone="amber">Sin registrarse</Badge>}
                  </span>
                  {p.user?.lastLoginAt && (
                    <span className="mt-2 block font-mono text-[10px] text-ink/45">
                      Último acceso: {formatDate(p.user.lastLoginAt)}
                    </span>
                  )}
                </span>
                <UserCog className="size-5 shrink-0 text-ink/40" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Sin resultados" text="Prueba con otro filtro o búsqueda." />
      )}

      <Modal open={!!current} onClose={() => setSelected(null)} title="Gestionar usuario">
        {current && <PersonPanel person={current} events={events} />}
      </Modal>
    </div>
  );
}

function PersonPanel({ person, events }: { person: Person; events: EventDoc[] }) {
  const { user } = useAuth();
  const access = useAccess();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const isSuper = person.role === "superadmin";
  const isMe = normalizeEmail(user?.email ?? "") === person.email;

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast(ok);
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  const staffValue: StaffRole | "user" = person.role === "superadmin" ? "admin" : person.role;
  const sortedEvents = [...events].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-lime font-mono text-sm font-bold text-coal">
          {initials(person.user?.displayName || person.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{person.user?.displayName || "Sin nombre"}</p>
          <p className="truncate font-mono text-[11px] text-ink/55">{person.email}</p>
          {!person.user && (
            <p className="font-mono text-[10px] text-amber-700">Aún no crea su cuenta. Los permisos se aplican al registrarse.</p>
          )}
        </div>
      </div>

      <section className="space-y-2">
        <p className="text-sm font-medium">Permiso en la plataforma</p>
        {isSuper ? (
          <p className="rounded-2xl bg-paper p-3 font-mono text-[11px] text-ink/65">
            Superadmin fijo de la plataforma. No se puede cambiar ni suspender.
          </p>
        ) : access.isSuperadmin ? (
          <>
            <Segmented<StaffRole | "user">
              label="Permiso global"
              value={staffValue}
              disabled={!!busy || isMe}
              onChange={(role) =>
                run("role", () => setStaffRole(person.email, role, user!), `Permiso actualizado: ${GLOBAL_ROLE_LABEL[role]}.`)
              }
              options={[
                { id: "user", label: "Usuario" },
                { id: "organizer", label: "Organizador" },
                { id: "admin", label: "Admin" },
                { id: "blocked", label: "Suspendido" },
              ]}
            />
            <p className="font-mono text-[11px] leading-relaxed text-ink/55">{ROLE_HELP[staffValue]}</p>
          </>
        ) : (
          <p className="rounded-2xl bg-paper p-3 font-mono text-[11px] text-ink/65">
            {GLOBAL_ROLE_LABEL[person.role]}. Solo el superadmin puede cambiar permisos.
          </p>
        )}
      </section>

      <section>
        <p className="text-sm font-medium">Juez en eventos</p>
        <p className="font-mono text-[11px] text-ink/55">Activa los eventos donde esta persona calificará proyectos.</p>
        <div className="mt-2 divide-y divide-ink/5 rounded-2xl bg-paper px-4">
          {sortedEvents.map((e) => (
            <Toggle
              key={e.id}
              label={e.name}
              description={e.institution || undefined}
              checked={e.judgeEmails.includes(person.email)}
              disabled={busy === `j:${e.id}`}
              onChange={(v) =>
                run(`j:${e.id}`, () => setEventMembership(e, person.email, "judgeEmails", v), v ? "Agregado como juez." : "Quitado de jueces.")
              }
            />
          ))}
          {!sortedEvents.length && <p className="py-3 font-mono text-xs text-ink/50">No hay eventos.</p>}
        </div>
      </section>

      <section>
        <p className="text-sm font-medium">Organizador en eventos</p>
        <p className="font-mono text-[11px] text-ink/55">Puede administrar ese evento aunque no sea admin global.</p>
        <div className="mt-2 divide-y divide-ink/5 rounded-2xl bg-paper px-4">
          {sortedEvents.map((e) => {
            const owner = e.ownerEmail === person.email;
            return (
              <Toggle
                key={e.id}
                label={e.name}
                description={owner ? "Creador del evento (no se puede quitar)" : e.institution || undefined}
                checked={e.organizerEmails.includes(person.email)}
                disabled={owner || busy === `o:${e.id}`}
                onChange={(v) =>
                  run(
                    `o:${e.id}`,
                    () => setEventMembership(e, person.email, "organizerEmails", v),
                    v ? "Agregado como organizador." : "Quitado de organizadores.",
                  )
                }
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ---------- Eventos ---------- */

function EventsTab({ events, projects }: { events: EventDoc[]; projects: ProjectDoc[] }) {
  const [team, setTeam] = useState<string | null>(null);
  const current = events.find((e) => e.id === team) ?? null;
  const sorted = [...events].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));

  if (!events.length) {
    return <EmptyState icon={<CalendarDays className="size-5" />} title="No hay eventos" text="Los eventos creados en la plataforma aparecerán aquí." />;
  }

  return (
    <>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
        {sorted.map((e) => {
          const count = projects.filter((p) => p.eventId === e.id).length;
          return (
            <li key={e.id} className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
              <div className="min-w-0">
                <EventStatus event={e} />
                <h3 className="mt-3 break-words font-display text-lg font-bold leading-tight">{e.name}</h3>
                <p className="mt-0.5 font-mono text-[11px] text-ink/55">{e.institution || "Sin institución"}</p>
                <p className="truncate font-mono text-[10px] text-ink/45">Creado por {e.ownerEmail}</p>
              </div>
              <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-center">
                <MiniStat label="Proyectos" value={count} />
                <MiniStat label="Jueces" value={e.judgeEmails.length} />
                <MiniStat label="Organiz." value={e.organizerEmails.length} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setTeam(e.id)}>
                  <Gavel className="size-3.5" /> Jueces y organizadores
                </Button>
                <Link
                  href={`/eventos/${e.id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 font-mono text-xs hover:bg-ink/5"
                >
                  Abrir <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal open={!!current} onClose={() => setTeam(null)} title={current?.name ?? ""}>
        {current && (
          <div className="space-y-4 [&>div]:p-0">
            <EmailListEditor
              title="Jueces"
              subtitle="Entran con este correo y ven el evento en «Para evaluar»."
              emails={current.judgeEmails}
              onSave={(judgeEmails) => updateEvent(current.id, { judgeEmails })}
            />
            <EmailListEditor
              title="Organizadores"
              subtitle="Administran este evento."
              emails={current.organizerEmails}
              locked={[current.ownerEmail]}
              onSave={(organizerEmails) => updateEvent(current.id, { organizerEmails })}
            />
          </div>
        )}
      </Modal>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-paper px-2 py-2.5">
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      <p className="font-mono text-[10px] text-ink/50">{label}</p>
    </div>
  );
}

/* ---------- Permisos ---------- */

function RolesTab({ people }: { people: Person[] }) {
  const { user } = useAuth();
  const access = useAccess();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("organizer");
  const [busy, setBusy] = useState(false);
  const withRoles = people.filter((p) => p.role !== "user");

  async function grant(e: FormEvent) {
    e.preventDefault();
    const target = normalizeEmail(email);
    if (!isEmail(target)) return toast("Escribe un correo válido.", "error");
    if (target === SUPERADMIN_EMAIL) return toast("El superadmin no se puede modificar.", "error");
    setBusy(true);
    try {
      await setStaffRole(target, role, user!);
      toast(`${target} ahora es ${GLOBAL_ROLE_LABEL[role]}.`);
      setEmail("");
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card className="h-fit">
        <SectionTitle
          title="Dar permiso"
          subtitle="Funciona aunque la persona aún no tenga cuenta: se aplica cuando se registre con ese correo."
        />
        {access.isSuperadmin ? (
          <form onSubmit={grant} className="space-y-4">
            <Field label="Correo" htmlFor="grant-email">
              <Input
                id="grant-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="persona@escuela.mx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <div className="space-y-2">
              <Segmented<StaffRole>
                label="Permiso"
                value={role}
                onChange={setRole}
                options={[
                  { id: "organizer", label: "Organizador" },
                  { id: "admin", label: "Admin" },
                  { id: "blocked", label: "Suspendido" },
                ]}
              />
              <p className="font-mono text-[11px] leading-relaxed text-ink/55">{ROLE_HELP[role]}</p>
            </div>
            <Button type="submit" loading={busy} className="w-full sm:w-auto">
              Guardar permiso
            </Button>
          </form>
        ) : (
          <p className="rounded-2xl bg-paper p-3 font-mono text-[11px] text-ink/65">Solo el superadmin puede dar permisos.</p>
        )}
      </Card>

      <Card>
        <SectionTitle title="Con permisos especiales" subtitle="Todos los demás son usuarios normales." />
        <ul className="divide-y divide-ink/5">
          {withRoles.map((p) => (
            <li key={p.email} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{p.user?.displayName || p.email}</p>
                {p.user?.displayName && <p className="truncate font-mono text-[10px] text-ink/50">{p.email}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge tone={ROLE_TONE[p.role]}>{GLOBAL_ROLE_LABEL[p.role]}</Badge>
                {access.isSuperadmin && p.role !== "superadmin" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar permiso a ${p.email}`}
                    onClick={async () => {
                      try {
                        await setStaffRole(p.email, "user", user!);
                        toast("Permiso retirado.");
                      } catch (err) {
                        toast(firestoreErrorMessage(err), "error");
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
