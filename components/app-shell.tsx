"use client";

import { Ban, Lock, LogOut, MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { GLOBAL_ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LegalLinks } from "./legal-links";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { Button, Card, Spinner, useToast } from "./ui";

/**
 * Envoltura para páginas privadas: exige sesión y correo verificado
 * (los permisos de juez/organizador/integrante dependen del correo).
 * Con requireVerified={false} solo exige sesión: así cualquier cuenta,
 * aunque no esté verificada o esté suspendida, llega a «Privacidad de mi cuenta».
 */
export function AppShell({ children, requireVerified = true }: { children: React.ReactNode; requireVerified?: boolean }) {
  const { user, loading } = useAuth();
  const access = useAccess();
  const router = useRouter();
  const pathname = usePathname();
  // Si había sesión y se cerró (botón «Cerrar sesión» u otra pestaña), se vuelve a la portada.
  // Si nunca la hubo, se pide entrar y después se regresa a esta página.
  const hadSession = useRef(false);

  useEffect(() => {
    if (user) hadSession.current = true;
    else if (!loading) router.replace(hadSession.current ? "/" : `/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  let content: React.ReactNode = children;
  if (loading || !user || (requireVerified && access.loading)) content = <Spinner />;
  else if (requireVerified && !user.emailVerified) content = <VerifyEmail />;
  else if (requireVerified && access.blocked) content = <Blocked />;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4 sm:px-6 sm:pt-6">{content}</main>
      <footer className="border-t border-ink/5 px-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] pt-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 sm:flex-row sm:justify-between sm:gap-4">
          <Link
            href="/panel/privacidad"
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 font-mono text-[11px] hover:text-ink sm:min-h-0 sm:py-1",
              pathname === "/panel/privacidad" ? "text-ink" : "text-ink/60",
            )}
            aria-current={pathname === "/panel/privacidad" ? "page" : undefined}
          >
            <Lock className="size-3.5" aria-hidden /> Privacidad de mi cuenta
          </Link>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}

function Header() {
  const { user, signOut } = useAuth();
  const access = useAccess();
  const router = useRouter();
  const pathname = usePathname();
  const initials = (user?.displayName || user?.email || "?")
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  const showAdmin = access.isAdmin && user?.emailVerified;

  return (
    <header className="sticky top-0 z-30 border-b border-ink/5 bg-paper/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Logo href="/panel" />
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          {showAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-xl px-2.5 font-mono text-xs transition sm:px-3",
                pathname.startsWith("/admin") ? "bg-ink text-surface" : "hover:bg-ink/5",
              )}
              aria-label="Administración"
            >
              <ShieldCheck className="size-4" />
              <span className="hidden sm:inline">Administración</span>
            </Link>
          )}
          <ThemeToggle />
          {user && (
            <>
              <div className="hidden min-w-0 text-right md:block">
                <p className="truncate text-sm font-medium leading-tight">{user.displayName || "Sin nombre"}</p>
                <p className="truncate font-mono text-[10px] text-ink/50">
                  {access.role !== "user" ? `${GLOBAL_ROLE_LABEL[access.role]} · ` : ""}
                  {user.email}
                </p>
              </div>
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full bg-lime font-mono text-xs font-bold text-coal"
                title={user.email ?? ""}
                aria-hidden
              >
                {initials}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="size-10 px-0"
                aria-label="Cerrar sesión"
                onClick={async () => {
                  await signOut();
                  router.replace("/");
                }}
              >
                <LogOut className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Blocked() {
  const { signOut } = useAuth();
  return (
    <div className="mx-auto max-w-md pt-10">
      <Card className="text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-red-100 text-red-700">
          <Ban className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-bold">Cuenta suspendida</h1>
        <p className="mt-2 font-mono text-xs leading-relaxed text-ink/60">
          Un administrador suspendió el acceso de esta cuenta. Si crees que es un error, contacta al organizador del
          evento.
        </p>
        <Button variant="outline" className="mt-6 w-full" onClick={() => signOut()}>
          Cerrar sesión
        </Button>
      </Card>
    </div>
  );
}

function VerifyEmail() {
  const { user, resendVerification, refreshUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<"check" | "send" | null>(null);

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card className="text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-lime text-coal">
          <MailCheck className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-bold">Verifica tu correo</h1>
        <p className="mt-2 font-mono text-xs leading-relaxed text-ink/60">
          Enviamos un enlace a <strong className="text-ink">{user?.email}</strong>. Lo pedimos para que nadie pueda
          hacerse pasar por un juez o por un integrante de tu equipo. Revisa también spam.
        </p>
        <div className="mt-6 grid gap-2">
          <Button
            loading={busy === "check"}
            onClick={async () => {
              setBusy("check");
              const ok = await refreshUser().catch(() => false);
              setBusy(null);
              if (!ok) toast("Aún no aparece como verificado.", "error");
            }}
          >
            <RefreshCw className="size-4" /> Ya lo verifiqué
          </Button>
          <Button
            variant="outline"
            loading={busy === "send"}
            onClick={async () => {
              setBusy("send");
              try {
                await resendVerification();
                toast("Correo reenviado.");
              } catch {
                toast("Espera un momento antes de reenviar.", "error");
              }
              setBusy(null);
            }}
          >
            Reenviar correo
          </Button>
        </div>
      </Card>
    </div>
  );
}
