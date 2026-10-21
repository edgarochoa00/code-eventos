"use client";

import { ArrowLeft, ArrowUpRight, KeyRound, Palette, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { LegalLinks } from "@/components/legal-links";
import { readStoredTheme, resetTheme, type Theme } from "@/components/theme-toggle";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { LEGAL_VERSION, SERVICE_CONTACT } from "@/lib/legal";

type ControlId = "theme" | "session";

/** Botón-enlace que, a diferencia de ButtonLink, deja partir el texto en pantallas angostas. */
const ACTION_LINK =
  "inline-flex min-h-11 items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-left font-mono text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:justify-center";

const THEME_LABEL = { light: "modo claro", dark: "modo oscuro" } as const;

/** Se entera cuando el tema cambia en esta pestaña (botón del encabezado) o en otra (evento storage). */
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("storage", onChange);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onChange);
  };
}

/** Centro de privacidad: documentos vigentes, datos de este navegador y contacto para solicitudes. */
export function PrivacyCenter() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  // undefined mientras no se puede leer el navegador (render del servidor)
  const storedTheme = useSyncExternalStore<Theme | null | undefined>(subscribeTheme, readStoredTheme, () => undefined);
  const [confirm, setConfirm] = useState<ControlId | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function apply(id: ControlId) {
    setError("");
    setMessage("");
    if (id === "theme") {
      resetTheme();
      setConfirm(null);
      setMessage("Listo: este navegador vuelve a usar el tema de tu sistema.");
      return;
    }
    setBusy(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setBusy(false);
      setConfirm(null);
      setError("No se pudo cerrar la sesión. Revisa tu conexión e intenta de nuevo.");
    }
  }

  const controls: {
    id: ControlId;
    icon: LucideIcon;
    title: string;
    text: string;
    status: string;
    label: string;
    question: string;
    disabled: boolean;
  }[] = [
    {
      id: "theme",
      icon: Palette,
      title: "Preferencia de tema",
      text: "Guarda si prefieres modo claro u oscuro en este navegador (clave theme). Al restablecerla se usa la configuración de tu sistema.",
      status:
        storedTheme === undefined
          ? "Comprobando…"
          : storedTheme
            ? `Guardada: ${THEME_LABEL[storedTheme]}.`
            : "Sin preferencia guardada: se usa la de tu sistema.",
      label: "Restablecer tema",
      question: "¿Restablecer el tema de este navegador?",
      disabled: !storedTheme,
    },
    {
      id: "session",
      icon: KeyRound,
      title: "Sesión en este navegador",
      text: "Firebase guarda tu sesión para que no tengas que entrar en cada visita. Al cerrarla se borra de este navegador; tus eventos y proyectos siguen guardados en el servicio.",
      status: user?.email ? `Sesión iniciada como ${user.email}.` : "Sin sesión iniciada.",
      label: "Cerrar sesión en este dispositivo",
      question: "¿Cerrar sesión en este navegador? Tendrás que volver a entrar.",
      disabled: !user,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel" className="inline-flex min-h-11 items-center gap-2 font-mono text-xs text-ink/55 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Volver al panel
      </Link>

      <div className="mt-2 rounded-[2rem] bg-surface p-7 sm:p-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50">Tu cuenta</p>
        <h1 className="mt-4 font-display text-[2.1rem] font-bold leading-[1.08] tracking-tight sm:text-5xl">Privacidad de mi cuenta</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink/70">
          Consulta los documentos del servicio y administra lo que C.O.D.E guarda en este navegador.
        </p>
      </div>

      <section aria-labelledby="documentos-titulo" className="mt-10">
        <h2 id="documentos-titulo" className="font-display text-xl font-bold sm:text-2xl">
          Documentos del servicio
        </h2>
        <LegalLinks showVersion={false} align="start" className="mt-2" />
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          Versión de los documentos · {LEGAL_VERSION}. Entrar con Google solo confirma tu identidad; no se registra como
          aceptación de un contrato.
        </p>
      </section>

      <section aria-labelledby="dispositivo-titulo" className="mt-10 border-t border-ink/10 pt-8">
        <h2 id="dispositivo-titulo" className="font-display text-xl font-bold sm:text-2xl">
          En este dispositivo
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          C.O.D.E no usa cookies. Estos controles solo afectan a este navegador y no borran nada de lo guardado en el
          servicio. Para quitar todo lo que el sitio guarda, incluido el registro técnico de Firebase, borra los datos del
          sitio desde la configuración de tu navegador.
        </p>

        {message && (
          <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 font-mono text-[11px] text-emerald-800">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 font-mono text-[11px] text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 grid gap-3">
          {controls.map(({ id, icon: Icon, title, text, status, label, question, disabled }) => (
            <article key={id} className="flex items-start gap-4 rounded-3xl bg-surface p-5 sm:p-6">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-night text-lime" aria-hidden>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink/70">{text}</p>
                <p className="mt-2 font-mono text-[11px] text-ink/50 [overflow-wrap:anywhere]">{status}</p>
                {confirm === id ? (
                  <div className="mt-4 rounded-2xl border border-ink/10 bg-paper p-4">
                    <p className="text-sm font-medium">{question}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
                        Cancelar
                      </Button>
                      <Button variant="dark" onClick={() => apply(id)} loading={busy}>
                        Confirmar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-ink/15 bg-surface px-4 py-2.5 text-left font-mono text-sm font-medium transition hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => {
                      setMessage("");
                      setError("");
                      setConfirm(id);
                    }}
                  >
                    {label}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="servicio-titulo" className="mt-10 border-t border-ink/10 pt-8">
        <h2 id="servicio-titulo" className="font-display text-xl font-bold sm:text-2xl">
          Datos guardados en el servicio
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          Tus eventos, proyectos, entregas y calificaciones se guardan en el servicio, no en este navegador. Para solicitar
          acceso, rectificación, cancelación, oposición o el cierre de tu cuenta, escribe a {SERVICE_CONTACT.name}. La
          atención es manual y requiere verificar tu identidad.
        </p>
        {/* En el celular van a todo lo ancho y el texto puede partirse en dos líneas */}
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2 sm:flex sm:flex-wrap">
          <a
            href={`mailto:${SERVICE_CONTACT.email}?subject=${encodeURIComponent("Privacidad C.O.D.E")}`}
            className={`${ACTION_LINK} bg-lime text-coal hover:brightness-95`}
          >
            Contactar por privacidad <ArrowUpRight className="size-4 shrink-0" aria-hidden />
          </a>
          <Link href="/privacidad" className={`${ACTION_LINK} border border-ink/15 bg-surface hover:border-ink/40`}>
            Consultar el aviso de privacidad <ArrowUpRight className="size-4 shrink-0" aria-hidden />
          </Link>
        </div>
        <p className="mt-3 font-mono text-[11px] text-ink/50 [overflow-wrap:anywhere]">{SERVICE_CONTACT.email}</p>
      </section>
    </div>
  );
}
