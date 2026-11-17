"use client";

import { Ban, ChevronDown, Lock, LogOut, MailCheck, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { cn, displayEmail, initials } from "@/lib/utils";
import { LegalLinks } from "./legal-links";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { Button, Card, Spinner, useToast } from "./ui";

/**
 * Envoltura para páginas privadas: exige sesión y correo verificado
 * (los permisos de juez/organizador/integrante dependen del correo).
 * Con requireVerified={false} solo exige sesión: así cualquier cuenta,
 * aunque no esté verificada o esté suspendida, puede consultar su cuenta.
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
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-ink focus:px-4 focus:py-3 focus:text-surface">
        Ir al contenido
      </a>
      <Header />
      <main id="contenido" className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-16 pt-5 sm:px-6 sm:pt-8">{content}</main>
      <footer className="border-t border-line bg-surface px-4 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] pt-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 sm:flex-row sm:justify-between sm:gap-4">
          <Link
            href="/panel/privacidad"
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 font-mono text-[11px] hover:text-ink sm:min-h-0 sm:py-1",
              pathname === "/panel/privacidad" ? "text-ink" : "text-muted",
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
  const showAdmin = access.isAdmin && user?.emailVerified;
  const [accountOpen, setAccountOpen] = useState(false);
  const account = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const accountInitials = initials(user?.displayName || displayEmail(user?.email ?? ""));

  useEffect(() => {
    if (!accountOpen) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !account.current?.contains(event.target)) setAccountOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [accountOpen]);

  async function handleSignOut() {
    setAccountOpen(false);
    await signOut();
    router.replace("/");
  }

  const accountAction = "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium hover:bg-field [&>svg]:shrink-0";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface pt-[env(safe-area-inset-top)] shadow-xs">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Logo href="/panel" />
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {showAdmin && (
            <Link
              href="/admin"
              className={cn(
                "hidden min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border-2 px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.08em] transition sm:flex",
                pathname.startsWith("/admin")
                  ? "border-ink bg-ink text-surface"
                  : "border-line bg-surface text-ink hover:border-ink/40",
              )}
              aria-label="Administración"
            >
              <ShieldCheck className="size-4" />
              <span>Administración</span>
            </Link>
          )}
          <ThemeToggle />
          {user && (
            <>
              <Link
                href="/panel/perfil"
                className="hidden min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-1 hover:bg-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:flex md:max-w-60 md:pl-3"
                aria-label="Mi perfil"
                aria-current={pathname === "/panel/perfil" ? "page" : undefined}
                title="Mi perfil"
              >
                <span className="hidden min-w-0 text-right md:block">
                  <span className="block truncate text-sm font-medium leading-tight">{user.displayName || "Mi perfil"}</span>
                  <span className="block truncate font-mono text-[10px] text-muted">{displayEmail(user.email ?? "")}</span>
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime font-mono text-xs font-bold text-coal" aria-hidden>
                  {accountInitials}
                </span>
              </Link>
              <button
                type="button"
                className="hidden size-11 shrink-0 place-items-center rounded-full hover:bg-field sm:grid"
                aria-label="Cerrar sesión"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
              </button>
              <div
                ref={account}
                className="relative sm:hidden"
                onKeyDown={(event) => {
                  if (event.key === "Escape" && accountOpen) {
                    setAccountOpen(false);
                    accountButton.current?.focus();
                  }
                }}
              >
                <button
                  ref={accountButton}
                  type="button"
                  className="flex min-h-11 min-w-11 items-center justify-center gap-0.5 rounded-full px-1 hover:bg-field"
                  aria-label="Menú de cuenta"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((open) => !open)}
                >
                  <span className="grid size-8 place-items-center rounded-full bg-lime text-xs font-bold text-coal" aria-hidden>
                    {accountInitials}
                  </span>
                  <ChevronDown className="size-3 text-muted" aria-hidden />
                </button>
                {accountOpen && (
                  <div className="ui-panel absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5">
                    <Link
                      href="/panel/perfil"
                      className={accountAction}
                      aria-current={pathname === "/panel/perfil" ? "page" : undefined}
                      onClick={() => setAccountOpen(false)}
                    >
                      <UserRound className="size-4" aria-hidden /> Mi perfil
                    </Link>
                    {showAdmin && (
                      <Link href="/admin" className={accountAction} onClick={() => setAccountOpen(false)}>
                        <ShieldCheck className="size-4" aria-hidden /> Administración
                      </Link>
                    )}
                    <button type="button" className={accountAction} onClick={handleSignOut}>
                      <LogOut className="size-4" aria-hidden /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
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
        <p className="mt-2 font-mono text-xs leading-relaxed text-muted">
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
  const { resendVerification, refreshUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<"check" | "send" | null>(null);

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card className="text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-lime text-coal">
          <MailCheck className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-bold">Verifica tu correo</h1>
        <p className="mt-2 font-mono text-xs leading-relaxed text-muted">
          Confirma que este correo es tuyo para entrar con tu rol. Si aún no tienes
          un enlace de verificación, puedes enviarlo con el botón de abajo. Revisa también spam.
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
                toast("Correo de verificación enviado.");
              } catch {
                toast("Espera un momento antes de reenviar.", "error");
              }
              setBusy(null);
            }}
          >
            Enviar o reenviar verificación
          </Button>
        </div>
      </Card>
    </div>
  );
}
