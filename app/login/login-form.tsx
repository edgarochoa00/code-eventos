"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { LegalLinks } from "@/components/legal-links";
import { APP_SUBTITLE, Logo } from "@/components/logo";
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
    <div className="flex flex-1 flex-col px-4 py-4 sm:px-10 sm:py-6">
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6 sm:py-10">
        <div className="rounded-3xl border-2 border-line bg-surface p-6 shadow-xs sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="grid size-24 place-items-center overflow-hidden rounded-full bg-white p-1 shadow-md ring-2 ring-ink/15">
              <Image
                src="/logo.png"
                alt="Logo TECNM Culiacán · Sistemas Computacionales y TICs"
                width={92}
                height={92}
                className="size-full object-contain"
                priority
              />
            </span>
            <p className="mt-3 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-ink/75">
              {APP_SUBTITLE}
            </p>
          </div>

          <h2 className="font-display text-2xl font-extrabold uppercase tracking-[0.04em] sm:text-3xl">
            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </h2>

          <div className="mt-5">
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

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
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
              <p role="alert" className="rounded-2xl bg-red-50 px-3.5 py-2.5 font-sans text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" loading={busy}>
              {mode === "login" ? "Entrar" : "Crear cuenta"} <ArrowUpRight className="size-4" />
            </Button>
          </form>

          {mode === "login" && (
            <button
              type="button"
              onClick={onReset}
              className="mt-5 font-display text-[11px] font-bold uppercase tracking-[0.08em] text-muted underline underline-offset-4 hover:text-ink"
            >
              Olvidé mi contraseña
            </button>
          )}
        </div>
      </div>
      <LegalLinks className="mx-auto w-full max-w-md pb-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
