import { ArrowLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { LEGAL_UPDATED_LABEL, LEGAL_VERSION, PRODUCT_VERSION, RELEASES } from "@/lib/legal";
import { LEGAL_DOCUMENTS, type LegalDocument, type LegalDocumentKey } from "@/lib/legal-content";
import { cn } from "@/lib/utils";
import { LegalLinks } from "./legal-links";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const REFERENCES = [
  { href: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf", label: "Legislación mexicana vigente" },
  { href: "https://firebase.google.com/support/privacy", label: "Privacidad en Firebase" },
  { href: "https://firebase.google.com/docs/auth/web/auth-state-persistence", label: "Persistencia de sesión en Firebase" },
  { href: "https://vercel.com/legal/privacy-policy", label: "Privacidad en Vercel" },
];

/** Página pública de información del servicio: un documento legal o el historial de versiones. */
export function LegalPage({ documentKey }: { documentKey: LegalDocumentKey | "versiones" }) {
  const doc = documentKey === "versiones" ? null : LEGAL_DOCUMENTS[documentKey];

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex min-h-20 w-full max-w-6xl items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] sm:px-8">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/panel"
            prefetch={false}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink px-3.5 font-mono text-xs font-medium text-surface hover:bg-ink/90"
          >
            Ir a mi panel <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </header>

      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-mono text-xs text-ink/55 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Volver a C.O.D.E
        </Link>

        <div className="mt-2 rounded-[2rem] bg-surface p-7 sm:p-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50">
            {doc ? "Información del servicio · México" : "Evolución del producto"}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-[2.1rem] font-bold leading-[1.08] tracking-tight sm:text-5xl">
            {doc ? doc.title : "Versiones de C.O.D.E"}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink/70">
            {doc ? doc.intro : "Las mejoras que llegan a tus eventos, versión por versión."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 font-mono text-[11px] text-ink/65">
            {doc ? (
              <>
                <span className="rounded-full bg-ink/5 px-3 py-1.5">Actualizado · {LEGAL_UPDATED_LABEL}</span>
                <span className="rounded-full bg-ink/5 px-3 py-1.5">
                  {doc.technical ? "Información técnica" : "Versión del documento"} · {LEGAL_VERSION}
                </span>
              </>
            ) : (
              <span className="rounded-full bg-ink/5 px-3 py-1.5">Versión actual · v{PRODUCT_VERSION}</span>
            )}
          </div>
        </div>

        {doc ? <DocumentBody doc={doc} deviceLink={documentKey === "cookies"} /> : <ReleaseList />}
      </main>

      <footer className="border-t border-ink/5 px-4 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.25rem))] pt-6">
        <LegalLinks />
        <p className="mt-2 text-center font-mono text-[10px] text-ink/40">C.O.D.E · Evaluación de proyectos escolares</p>
      </footer>
    </div>
  );
}

function DocumentBody({ doc, deviceLink }: { doc: LegalDocument; deviceLink: boolean }) {
  return (
    <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
      <nav aria-label="Contenido del documento" className="border-b border-ink/10 pb-4 lg:sticky lg:top-6 lg:self-start lg:border-0 lg:pb-0">
        <p className="font-mono text-[11px] text-ink/45">En esta página</p>
        <ul className="mt-2 lg:mt-3">
          {doc.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex min-h-11 items-center font-mono text-xs leading-snug text-ink/60 hover:text-ink lg:min-h-0 lg:py-1.5"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="min-w-0 max-w-[72ch]">
        {doc.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-titulo`}
            className="scroll-mt-6 border-b border-ink/10 py-7 first:pt-0 last:border-0"
          >
            <h2 id={`${section.id}-titulo`} className="font-display text-xl font-bold sm:text-2xl">
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-[15px] leading-7 text-ink/75 [overflow-wrap:anywhere]">
                {paragraph}
              </p>
            ))}
            {section.links?.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="mt-2 inline-flex min-h-11 max-w-full items-center font-mono text-xs font-medium underline underline-offset-4 [overflow-wrap:anywhere] hover:text-ink/70"
              >
                {link.label}
              </a>
            ))}
          </section>
        ))}

        {deviceLink && (
          <Link
            href="/panel/privacidad"
            prefetch={false}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink/15 bg-surface px-4 py-2.5 font-mono text-xs font-medium hover:border-ink/40"
          >
            Administrar datos de este dispositivo <ArrowUpRight className="size-4 shrink-0" aria-hidden />
          </Link>
        )}

        <section aria-labelledby="referencias-titulo" className="mt-10 border-t border-ink/10 pt-6">
          <h2 id="referencias-titulo" className="font-mono text-xs font-medium">
            Referencias
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-5">
            {REFERENCES.map((ref) => (
              <li key={ref.href}>
                <a
                  href={ref.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 font-mono text-[11px] text-ink/60 underline underline-offset-2 hover:text-ink"
                >
                  {ref.label} <ArrowUpRight className="size-3" aria-hidden />
                  <span className="sr-only">(se abre en otra pestaña)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}

function ReleaseList() {
  return (
    <ol className="mt-10" aria-label="Historial de versiones">
      {RELEASES.map((release, i) => (
        <li
          key={release.version}
          className="grid grid-cols-[minmax(0,1fr)] gap-4 border-t border-ink/10 py-8 first:border-0 first:pt-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-10"
        >
          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start">
            <span className={cn("rounded-full px-3 py-1 font-mono text-sm font-bold", i === 0 ? "bg-lime text-coal" : "bg-ink/5")}>
              v{release.version}
            </span>
            <span className="font-mono text-[11px] text-ink/50">{release.date}</span>
            {i === 0 && <span className="font-mono text-[10px] uppercase tracking-wider text-ink/45">Versión actual</span>}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold sm:text-2xl">{release.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {release.changes.map((change) => (
                <li key={change} className="flex gap-2.5 text-[15px] leading-7 text-ink/75">
                  <CheckCircle2 className="mt-1.5 size-3.5 shrink-0" aria-hidden />
                  {change}
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  );
}
