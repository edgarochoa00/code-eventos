"use client";

import { ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { useEffect, useState, type FormEvent } from "react";
import { Button, ButtonLink, Field, Input, Spinner } from "@/components/ui";
import { authErrorMessage } from "@/lib/auth";
import { auth } from "@/lib/firebase";

type AccessState =
  | { status: "checking" | "invalid" | "saved" }
  | { status: "retry"; message: string }
  | { status: "ready"; email: string; code: string };

function isInvalidLink(error: unknown) {
  return ["auth/expired-action-code", "auth/invalid-action-code", "auth/user-disabled", "auth/user-not-found"]
    .includes((error as { code?: string })?.code ?? "");
}

function accessCode() {
  return new URLSearchParams(window.location.hash.slice(1)).get("oobCode");
}

export function AccessForm() {
  const [state, setState] = useState<AccessState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onNewLink() {
      setState({ status: "checking" });
      setAttempt((value) => value + 1);
      setPassword("");
      setConfirmation("");
      setVisible(false);
      setError("");
      setBusy(false);
    }
    window.addEventListener("hashchange", onNewLink);
    return () => window.removeEventListener("hashchange", onNewLink);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkLink() {
      const code = accessCode();
      if (!code) return { status: "invalid" } as const;
      try {
        const email = await verifyPasswordResetCode(auth, code);
        return { status: "ready", email, code } as const;
      } catch (err) {
        if (isInvalidLink(err)) return { status: "invalid" } as const;
        return { status: "retry", message: authErrorMessage(err) } as const;
      }
    }
    void checkLink().then((result) => { if (!cancelled) setState(result); });
    return () => { cancelled = true; };
  }, [attempt]);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== "ready" || busy || accessCode() !== state.code) return;
    if (password !== confirmation) return setError("Las contraseñas no coinciden.");
    setError("");
    setBusy(true);
    try {
      await confirmPasswordReset(auth, state.code, password);
      if (accessCode() !== state.code) return;
      setState({ status: "saved" });
      setPassword("");
      setConfirmation("");
      setBusy(false);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err) {
      if (accessCode() !== state.code) return;
      if (isInvalidLink(err)) {
        setState({ status: "invalid" });
        setPassword("");
        setConfirmation("");
      } else setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  const title = state.status === "saved" ? "Contraseña guardada"
    : state.status === "invalid" ? "Enlace no disponible" : "Configura tu acceso";

  return (
    <>
      <h1 className="font-display text-2xl font-extrabold uppercase tracking-[0.04em] sm:text-3xl">{title}</h1>
      {state.status === "checking" && <Spinner label="Verificando tu enlace" />}
      {state.status === "retry" && (
        <div className="mt-3 space-y-5">
          <p role="alert" className="text-sm text-muted">No pudimos verificar el enlace. {state.message}</p>
          <Button className="w-full" type="button" onClick={() => {
            setState({ status: "checking" });
            setAttempt((value) => value + 1);
          }}>Volver a intentar</Button>
        </div>
      )}
      {(state.status === "invalid" || state.status === "saved") && (
        <div className="mt-3 space-y-5">
          <p role="status" className="text-sm leading-relaxed text-muted">
            {state.status === "saved"
              ? "Ya puedes entrar a Feria 2026 con tu correo y la contraseña que acabas de guardar."
              : "El enlace está incompleto, caducó o ya se utilizó. Si ya tienes contraseña, puedes iniciar sesión. Si necesitas un enlace nuevo, pídelo a quien te invitó."}
          </p>
          <ButtonLink className="w-full" size="lg" href="/login">Ir a iniciar sesión <ArrowUpRight className="size-4" aria-hidden /></ButtonLink>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted">Elige la contraseña que usarás para entrar a Feria 2026.</p>
          <div className="mt-4 rounded-2xl border border-line bg-field px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Correo de la cuenta</p>
            <p className="mt-1 text-sm font-semibold [overflow-wrap:anywhere]">{state.email}</p>
          </div>
          <form onSubmit={savePassword} className="mt-5 space-y-4">
            <input type="hidden" name="username" autoComplete="username" value={state.email} />
            <Field label="Nueva contraseña" htmlFor="new-password">
              <div className="relative">
                <Input id="new-password" name="new-password" autoComplete="new-password" type={visible ? "text" : "password"}
                  className="pr-12" aria-describedby="password-requirements" minLength={6} value={password}
                  onChange={(event) => setPassword(event.target.value)} required disabled={busy} />
                <button type="button" aria-label={visible ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-2xl text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
                  onClick={() => setVisible((value) => !value)}>
                  {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
              <p id="password-requirements" className="text-xs text-muted">Usa al menos 6 caracteres.</p>
            </Field>
            <Field label="Confirma tu contraseña" htmlFor="confirm-password">
              <Input id="confirm-password" name="confirm-password" autoComplete="new-password" type={visible ? "text" : "password"}
                value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required disabled={busy} />
            </Field>
            {error && <p role="alert" className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">{error}</p>}
            <Button className="w-full" size="lg" type="submit" loading={busy}>
              {busy ? "Guardando contraseña" : "Guardar contraseña"}
            </Button>
          </form>
        </>
      )}
    </>
  );
}
