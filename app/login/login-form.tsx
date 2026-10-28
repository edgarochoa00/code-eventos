"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { LegalLinks } from "@/components/legal-links";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Field, Input, Tabs, useToast } from "@/components/ui";
import { authErrorMessage, useAuth } from "@/lib/auth";

type Mode = "login" | "signup";

export function LoginForm() {
  const { user, loading, signInEmail, signUpEmail, resetPassword } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const raw = params.get("next") ?? "/panel";
  // Solo rutas internas
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/panel";

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "signup" && name.trim().length < 3) return setError("Escribe tu nombre completo.");
    setBusy(true);
    try {
      if (mode === "login") await signInEmail(email, password);
      else await signUpEmail(name, email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (!email) return setError("Escribe tu correo arriba y vuelve a intentarlo.");
    try {
      await resetPassword(email);
      toast("Te enviamos un correo para restablecer tu contraseña.");
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <div className="grid flex-1 lg:grid-cols-[repeat(2,minmax(0,1fr))]">
      <div className="relative hidden overflow-hidden bg-lime p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo />
        <div>
          <h1 className="font-display text-5xl font-bold leading-[1.05]">
            Tu evento,
            <br />
            tus proyectos,
            <br />
            una sola app.
          </h1>
          <p className="mt-4 max-w-sm font-mono text-xs leading-relaxed text-ink/70">
            Usa el mismo correo con el que te invitaron como juez u organizador, o con el que tu equipo te agregó.
          </p>
        </div>
        <p className="font-mono text-[11px] text-ink/60">C.O.D.E · Evaluación de proyectos</p>
      </div>

      <div className="flex flex-col px-4 py-4 sm:px-10 sm:py-6">
        <div className="flex items-center justify-between">
          <div className="lg:invisible">
            <Logo />
          </div>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h2 className="font-display text-3xl font-bold">{mode === "login" ? "Bienvenido" : "Crea tu cuenta"}</h2>
          <p className="mt-1 font-mono text-xs text-ink/60">
            {mode === "login" ? "Entra para ver tus eventos y proyectos." : "Te tomará menos de un minuto."}
          </p>

          <div className="mt-6">
            <Tabs
              tabs={[
                { id: "login", label: "Entrar" },
                { id: "signup", label: "Crear cuenta" },
              ]}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError("");
              }}
            />
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field label="Nombre completo" htmlFor="name">
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
            )}
            <Field label="Correo" htmlFor="email" hint={mode === "signup" ? "De preferencia tu correo institucional." : undefined}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Contraseña" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" loading={busy}>
              {mode === "login" ? "Entrar" : "Crear cuenta"} <ArrowUpRight className="size-4" />
            </Button>
          </form>

          {mode === "login" && (
            <button type="button" onClick={onReset} className="mt-5 font-mono text-[11px] text-ink/60 underline">
              Olvidé mi contraseña
            </button>
          )}
        </div>
        <LegalLinks className="mx-auto w-full max-w-sm pb-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}

