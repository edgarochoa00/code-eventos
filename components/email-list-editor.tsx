"use client";

import { ChevronDown, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { SavedInvitationError, type InvitationScope } from "@/lib/account-invitations";
import { useAuth } from "@/lib/auth";
import { displayEmail, normalizeEmail, parseEmails } from "@/lib/utils";
import { AccountInvitationButton } from "./account-invitation-button";
import { Badge, Button, Card, SectionTitle, Select, Textarea, firestoreErrorMessage, useToast } from "./ui";

type StatusFilter = "all" | "registered" | "pending";

function useJudgeRegistration(eventId: string | undefined, emails: string[]) {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  const [response, setResponse] = useState<{ key: string; statuses: Record<string, boolean> | null }>();
  const key = eventId && user && emails.length
    ? JSON.stringify([eventId, user.uid, emails, revision])
    : null;

  useEffect(() => {
    if (!eventId || !user || !key) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        const token = await user.getIdToken();
        const result = await fetch(`/api/judge-registration?eventId=${encodeURIComponent(eventId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!result.ok) throw new Error("No se pudo consultar el registro.");
        const { statuses } = await result.json() as { statuses: Record<string, boolean> };
        if (!controller.signal.aborted) setResponse({ key, statuses });
      } catch {
        if (!controller.signal.aborted) setResponse({ key, statuses: null });
      }
    };
    void load();
    return () => controller.abort();
  }, [eventId, key, user]);

  const current = key === response?.key ? response : undefined;
  return {
    statuses: current?.statuses,
    loading: Boolean(key && !current),
    failed: current?.statuses === null,
    refresh: () => setRevision((value) => value + 1),
  };
}

/** Lista editable de correos (jueces u organizadores de un evento). */
export function EmailListEditor({
  title,
  subtitle,
  emails,
  locked = [],
  onSave,
  invitation,
}: {
  title: string;
  subtitle: string;
  emails: string[];
  locked?: string[];
  onSave: (emails: string[]) => Promise<void>;
  invitation?: InvitationScope;
}) {
  const toast = useToast();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [mailError, setMailError] = useState("");
  const filterId = useId();
  const judgeList = invitation?.kind === "event" && invitation.role === "judge";
  const [filter, setFilter] = useState<StatusFilter>("all");
  const { statuses, loading, failed, refresh } = useJudgeRegistration(judgeList ? invitation.eventId : undefined, emails);
  const matches = statuses && filter !== "all"
    ? emails.filter((email) => statuses[normalizeEmail(email)] === (filter === "registered"))
    : emails;
  const registeredCount = emails.filter((email) => statuses?.[normalizeEmail(email)] === true).length;
  const pendingCount = emails.filter((email) => statuses?.[normalizeEmail(email)] === false).length;

  async function save(next: string[]) {
    setBusy(true);
    try {
      await onSave(next);
      setMailError("");
      return true;
    } catch (err) {
      toast(firestoreErrorMessage(err), "error");
      if (err instanceof SavedInvitationError) {
        setMailError(err.message);
        return "mail-failed" as const;
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  const list = (
    <ul className="divide-y divide-line">
      {matches.map((email) => {
        const registered = statuses?.[normalizeEmail(email)];
        return (
          <li key={email} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-3">
            <div className="min-w-0 flex-1 basis-36">
              <p className="text-sm wrap-anywhere">{displayEmail(email)}</p>
              {judgeList && registered !== undefined && (
                <Badge className="mt-1" tone={registered ? "green" : "amber"}>{registered ? "Registrado" : "Pendiente"}</Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {invitation && !locked.includes(email) && <AccountInvitationButton scope={invitation} email={email} disabled={busy} />}
              {locked.includes(email) ? (
                <Badge>Creador</Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={`Quitar ${displayEmail(email)}`}
                  onClick={() => save(emails.filter((e) => e !== email))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </li>
        );
      })}
      {!matches.length && <li className="py-3 text-xs text-muted">{emails.length ? "No hay evaluadores con este estado." : "Nadie todavía."}</li>}
    </ul>
  );

  return (
    <Card>
      <SectionTitle title={title} subtitle={subtitle} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const added = parseEmails(raw);
          if (!added.length) return toast("Escribe al menos un correo válido.", "error");
          const result = await save(Array.from(new Set([...emails, ...added])));
          if (result) {
            setRaw("");
            if (result === true) toast(`${added.length} correo(s) agregado(s).${invitation ? " Acceso enviado por correo." : ""}`);
          }
        }}
        className="space-y-3"
      >
        <Textarea
          aria-label="Correos"
          rows={2}
          placeholder="juez1@escuela.mx, juez2@gmail.com"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <Button type="submit" size="sm" loading={busy}>
          <Plus className="size-4" /> Agregar
        </Button>
        {invitation && <p className="text-xs leading-relaxed text-muted">Al agregar un correo se envía un enlace para establecer la contraseña.
          El mensaje de Firebase puede decir «restablecer contraseña»; también sirve para elegirla por primera vez.
          Si la persona ya tiene cuenta, conserva su acceso hasta que decida cambiar la contraseña. Puede revisar también spam.</p>}
      </form>
      {mailError && <p role="alert" className="mt-3 break-words rounded-xl bg-red-50 p-3 text-xs text-red-700">{mailError}</p>}
      {judgeList ? (
        <details open className="group mt-5 rounded-2xl border border-line">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden className="size-4 shrink-0 transition group-open:rotate-180" />
            Lista de evaluadores
            <Badge className="ml-auto">{emails.length}</Badge>
          </summary>
          {emails.length > 0 && (
            <div className="space-y-2 border-y border-line p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 basis-40">
                  <label htmlFor={filterId} className="mb-1 block text-xs font-medium">Estado del registro</label>
                  <Select id={filterId} value={statuses ? filter : "all"} disabled={!statuses}
                    onChange={(e) => setFilter(e.target.value as StatusFilter)}>
                    <option value="all">Todos ({emails.length})</option>
                    <option value="registered">Registrados ({registeredCount})</option>
                    <option value="pending">Pendientes ({pendingCount})</option>
                  </Select>
                </div>
                <Button size="sm" variant="outline" loading={loading} onClick={refresh}>
                  <RefreshCw className="size-4" /> Actualizar
                </Button>
              </div>
              {failed
                ? <p role="status" className="text-xs text-muted">No se pudo consultar el registro. Pulsa Actualizar para reintentar.</p>
                : <p className="text-xs text-muted">Registrado indica que el evaluador ya verificó su correo.</p>}
            </div>
          )}
          <div key={filter} role="region" aria-label="Lista de evaluadores" tabIndex={0}
            className="max-h-[min(42dvh,20rem)] overflow-y-auto rounded-b-2xl px-3 [scrollbar-gutter:stable]">
            {list}
          </div>
        </details>
      ) : <div className="mt-5">{list}</div>}
    </Card>
  );
}
