import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Gavel,
  GraduationCap,
  Rocket,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { LegalLinks } from "@/components/legal-links";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Landing() {
  return (
    <div className="flex-1 bg-paper">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-10 font-mono text-xs md:flex" aria-label="Secciones">
          <a href="#como-funciona" className="hover:underline">Cómo funciona</a>
          <a href="#roles" className="hover:underline">Roles</a>
          <a href="#dia-del-evento" className="hover:underline">Día del evento</a>
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/login" className="rounded-xl bg-ink px-4 py-2.5 font-mono text-xs font-medium text-surface hover:bg-ink/90">
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-7xl gap-4 px-4 sm:px-8 lg:grid-cols-[1fr_1.05fr]">
        <div className="flex flex-col justify-between rounded-[2rem] bg-surface p-7 sm:p-12 lg:min-h-[560px]">
          <div>
            <h1 className="font-display text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Evalúa proyectos
              <br />
              claro, justo y
              <br />
              sin papeles
            </h1>
            <p className="mt-6 max-w-sm font-mono text-xs leading-relaxed text-ink/70 sm:text-sm">
              Registro de equipos, entregas de prototipo y producto final, y calificación de jueces en un solo lugar.
            </p>
            <Link
              href="/panel"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-3 font-mono text-sm font-medium hover:brightness-95"
            >
              Comenzar <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-2">
            {[
              { icon: GraduationCap, label: "Alumnos" },
              { icon: Gavel, label: "Jueces" },
              { icon: ClipboardCheck, label: "Organizadores" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-3.5 py-2 font-mono text-xs">
                {label} <Icon className="size-4" />
              </span>
            ))}
          </div>
        </div>

        <div className="relative min-h-[540px] overflow-hidden rounded-[2rem] bg-lime">
          {/* Tarjeta flotante */}
          <div className="absolute left-5 top-6 z-20 w-56 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md sm:left-8 sm:top-8">
            <p className="font-mono text-[10px] text-ink/60">Proyecto A</p>
            <p className="mt-1 font-display text-2xl font-bold">92.5 pts</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-ink/70">
              <CheckCircle2 className="size-3" /> Producto final entregado
            </p>
          </div>

          <PhoneMock />
        </div>

        {/* Esquina recortada: va fuera del bloque lima para tomar el color real del fondo */}
        <div className="absolute bottom-0 right-4 z-20 rounded-tl-[2rem] bg-paper px-6 py-5 text-right font-mono text-[11px] font-medium uppercase leading-snug sm:right-8">
          Crea tu evento
          <br />
          en minutos
        </div>

        {/* Sello giratorio */}
        <a
          href="#como-funciona"
          className="absolute bottom-[-1.5rem] left-1/2 z-30 hidden size-32 -translate-x-1/2 place-items-center rounded-full bg-paper lg:grid"
          aria-label="Ver cómo funciona"
        >
          <svg viewBox="0 0 100 100" className="animate-spin-slow absolute inset-2" aria-hidden>
            <defs>
              <path id="circle" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
            </defs>
            <text className="fill-ink font-mono text-[9.5px] font-medium uppercase tracking-[0.2em]">
              <textPath href="#circle">Ver más • Ver más • Ver más •</textPath>
            </text>
          </svg>
          <ArrowDown className="size-5" />
        </a>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="mx-auto max-w-7xl scroll-mt-8 px-4 pt-20 sm:px-8">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Cómo funciona</h2>
        <p className="mt-2 max-w-lg font-mono text-xs text-ink/60">Cuatro pasos. Sin hojas de cálculo ni formularios sueltos.</p>
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(4,minmax(0,1fr))]">
          {[
            { icon: Rocket, title: "Crea el evento", text: "Define fechas, tamaño de equipo, rúbrica y si habrá prototipo, producto final o ambos." },
            { icon: Users, title: "Equipos se registran", text: "Los alumnos entran con un código de 6 letras y agregan a sus integrantes por correo." },
            { icon: Upload, title: "Suben sus entregas", text: "Prototipo y producto final en el mismo proyecto: descripción, repositorio, video, archivos." },
            { icon: Trophy, title: "Jueces califican", text: "Desde el celular, criterio por criterio. Tú publicas resultados cuando quieras." },
          ].map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="rounded-3xl bg-surface p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-lime">
                  <Icon className="size-5" />
                </span>
                <span className="font-mono text-xs text-ink/40">0{i + 1}</span>
              </div>
              <h3 className="mt-6 font-display text-lg font-bold">{title}</h3>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink/60">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="mx-auto max-w-7xl scroll-mt-8 px-4 pt-20 sm:px-8">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Cada quien ve lo suyo</h2>
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          <RoleCard
            tone="white"
            icon={<ClipboardCheck className="size-5" />}
            title="Organizadores"
            items={["Abre y cierra registro, entregas y evaluación", "Invita jueces por correo", "Edita la rúbrica y sus pesos", "Ve el avance de entregas y evaluaciones"]}
          />
          <RoleCard
            tone="lime"
            icon={<GraduationCap className="size-5" />}
            title="Alumnos"
            items={["Registra el proyecto y su equipo", "Sube prototipo y producto final", "Edita mientras la etapa esté abierta", "Recibe puntaje y comentarios"]}
          />
          <RoleCard
            tone="dark"
            icon={<Gavel className="size-5" />}
            title="Jueces"
            items={["Lista de proyectos por evaluar", "Calificación 0–10 por criterio", "Comentarios para cada equipo", "Total ponderado automático"]}
          />
        </div>
      </section>

      {/* Día del evento */}
      <section id="dia-del-evento" className="mx-auto max-w-7xl scroll-mt-8 px-4 py-20 sm:px-8">
        <div className="grid gap-8 overflow-hidden rounded-[2rem] bg-night p-7 text-white sm:p-12 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1 font-mono text-[11px] text-ink">
              <Activity className="size-3.5" /> En tiempo real
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold leading-tight sm:text-4xl">Sigue el día del evento en vivo</h2>
            <p className="mt-4 max-w-md font-mono text-xs leading-relaxed text-white/70">
              Mientras los equipos entregan y los jueces califican desde su celular, tu panel se actualiza solo. Cuando
              todo esté listo, publicas los resultados y cada equipo ve su lugar, su puntaje por criterio y los
              comentarios de los jueces.
            </p>
          </div>
          <div className="self-center">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Ejemplo · panel del organizador</p>
            <div className="space-y-3">
              {[
                { icon: Upload, value: "18/20", label: "Productos finales entregados", note: "Se actualiza en cuanto un equipo entrega", pct: 90 },
                { icon: Gavel, value: "42/60", label: "Evaluaciones de jueces", note: "Cada juez ve lo que le falta por calificar", pct: 70 },
                { icon: Trophy, value: "1º", label: "Proyecto A · 92.5 pts", note: "Resultados publicados con comentarios" },
              ].map(({ icon: Icon, value, label, note, pct }) => (
                <div key={label} className="flex items-center gap-4 rounded-2xl bg-white/5 p-4">
                  <div
                    className={`grid size-14 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold tabular-nums ${
                      pct === undefined ? "bg-lime text-coal" : "bg-white/10"
                    }`}
                  >
                    {value}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-display font-bold">
                      <Icon className="size-4 shrink-0" aria-hidden /> {label}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-white/50">{note}</p>
                    {pct !== undefined && (
                      <div className="mt-2 h-1.5 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">¿Listo para tu próximo evento?</h2>
          <Link
            href="/panel"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 font-mono text-sm font-medium text-surface hover:bg-ink/90"
          >
            Entrar a C.O.D.E <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink/5 px-4 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.25rem))] pt-6 text-center">
        <LegalLinks />
        <p className="mt-2 font-mono text-[11px] text-ink/50">C.O.D.E · Evaluación de proyectos escolares</p>
      </footer>
    </div>
  );
}

function RoleCard({
  tone,
  icon,
  title,
  items,
}: {
  tone: "white" | "lime" | "dark";
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  const styles = {
    white: "bg-surface",
    lime: "bg-lime",
    dark: "bg-night text-white",
  }[tone];
  return (
    <div className={`rounded-3xl p-7 ${styles}`}>
      <span className={`grid size-11 place-items-center rounded-2xl ${tone === "dark" ? "bg-lime text-coal" : "bg-night text-lime"}`}>
        {icon}
      </span>
      <h3 className="mt-6 font-display text-2xl font-bold">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {items.map((it) => (
          <li key={it} className="flex gap-2 font-mono text-xs leading-relaxed">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhoneMock() {
  const criteria = [
    { name: "Innovación", value: 9.5 },
    { name: "Viabilidad", value: 8.5 },
    { name: "Impacto", value: 9 },
    { name: "Presentación", value: 7.5 },
  ];
  return (
    <div className="absolute bottom-[-3rem] left-1/2 z-10 w-[270px] -translate-x-1/2 sm:left-[58%] sm:w-[300px]" aria-hidden>
      <div className="rounded-[2.8rem] border-[9px] border-ink bg-ink shadow-2xl">
        <div className="overflow-hidden rounded-[2.2rem] bg-[#221c1d] px-5 pb-12 pt-4 text-white">
          <div className="mx-auto mb-4 h-6 w-24 rounded-full bg-black" />
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-full bg-lime font-mono text-xs font-bold text-ink">JR</span>
            <div className="flex gap-2">
              <span className="grid size-9 place-items-center rounded-full bg-white/10">
                <Gavel className="size-4" />
              </span>
              <span className="grid size-9 place-items-center rounded-full bg-white/10">
                <Bell className="size-4" />
              </span>
            </div>
          </div>
          <p className="mt-5 font-mono text-[10px] text-white/60">Calificación total</p>
          <p className="font-display text-4xl font-bold">
            92.5 <span className="text-base font-normal text-white/50">/100</span>
          </p>
          <div className="mt-4 rounded-2xl bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Proyecto A</p>
                <p className="font-mono text-[9px] text-white/50">PRODUCTO FINAL</p>
              </div>
              <span className="rounded-full bg-lime px-2 py-0.5 font-mono text-[9px] text-ink">Evaluado</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {criteria.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between font-mono text-[9px] text-white/70">
                    <span>{c.name}</span>
                    <span>{c.value}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-lime" style={{ width: `${c.value * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/5 p-3">
            <div>
              <p className="text-xs font-medium">Proyecto B</p>
              <p className="font-mono text-[9px] text-white/50">PROTOTIPO</p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9px]">Pendiente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
