"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, Modal, Spinner } from "@/components/ui";
import { GLOBAL_ROLE_LABEL, PHASE_LABEL, type Phase } from "@/lib/types";
import {
  UserDeletionConflictError,
  type UserDeletionInspection,
  type UserDeletionResult,
} from "@/lib/user-deletion";
import { executeUserDeletion, inspectUserDeletion } from "@/lib/user-deletion-client";
import { displayEmail } from "@/lib/utils";

export type DeletionTarget = {
  email: string;
  uid?: string;
  displayName?: string;
};

export function UserDeletionModal({
  target,
  onCancel,
  onDeleted,
}: {
  target: DeletionTarget | null;
  onCancel: () => void;
  onDeleted: (result: UserDeletionResult) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <Modal open={!!target} onClose={() => { if (!deleting) onCancel(); }} title="Eliminar usuario por completo">
      {target && (
        <UserDeletionBody
          key={`${target.email}:${target.uid ?? ""}`}
          target={target}
          deleting={deleting}
          onDeletingChange={setDeleting}
          onCancel={onCancel}
          onDeleted={onDeleted}
        />
      )}
    </Modal>
  );
}

function UserDeletionBody({
  target,
  deleting,
  onDeletingChange,
  onCancel,
  onDeleted,
}: {
  target: DeletionTarget;
  deleting: boolean;
  onDeletingChange: (value: boolean) => void;
  onCancel: () => void;
  onDeleted: (result: UserDeletionResult) => void;
}) {
  const [inspection, setInspection] = useState<UserDeletionInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    inspectUserDeletion({
      ...(target.email ? { email: target.email } : {}),
      ...(target.uid ? { uid: target.uid } : {}),
    })
      .then((data) => {
        if (alive) setInspection(data);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "No se pudieron consultar los vínculos del usuario.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [target, reloadNonce]);

  function retryInspect() {
    setInspection(null);
    setLoading(true);
    setConfirmed(false);
    setError("");
    setReloadNonce((n) => n + 1);
  }

  async function handleConfirmDelete() {
    if (!inspection || deleting) return;
    onDeletingChange(true);
    setError("");
    try {
      const result = await executeUserDeletion({
        ...(inspection.target.email ? { email: inspection.target.email } : {}),
        ...(target.uid ? { uid: target.uid } : {}),
        inspectionHash: inspection.inspectionHash,
      });
      onDeleted(result);
    } catch (err) {
      if (err instanceof UserDeletionConflictError) {
        setInspection(err.inspection);
        setConfirmed(false);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "No se pudo eliminar el usuario. Intenta de nuevo.");
      }
    } finally {
      onDeletingChange(false);
    }
  }

  const labelEmail = inspection?.target.email || target.email || "";
  const labelName = inspection?.target.displayName || target.displayName || "Sin nombre";
  const recordItems = inspection ? buildRecordSummary(inspection) : [];

  if (loading) {
    return <Spinner label="Buscando vínculos en Firebase y Authentication" />;
  }

  if (!inspection) {
    return (
      <div className="space-y-4">
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 font-mono text-xs text-red-700">
          {error || "No se pudo consultar la información del usuario."}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={retryInspect}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-paper p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-bold">{labelName}</p>
                {labelEmail && (
                  <p className="truncate font-mono text-xs text-muted">{displayEmail(labelEmail)}</p>
                )}
                {inspection.target.uids.length > 0 && (
                  <p className="mt-1 truncate font-mono text-[10px] text-muted">
                    UID: {inspection.target.uids.join(", ")}
                  </p>
                )}
              </div>
              <Badge tone={inspection.records.authAccounts.length > 0 ? "green" : "neutral"}>
                {inspection.records.authAccounts.length > 0 ? "En Authentication" : "Sin Authentication"}
              </Badge>
            </div>
          </div>

          {!inspection.existsAnywhere ? (
            <>
              <div className="rounded-2xl border border-line bg-paper p-4 font-mono text-xs leading-relaxed text-muted">
                No se encontraron registros de este usuario en Firebase ni en Authentication.
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={onCancel}>
                  Cerrar
                </Button>
              </div>
            </>
          ) : (
            <>
              {inspection.hasLinks ? (
                <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-start gap-2.5 text-amber-900">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <div>
                      <p className="font-display text-xs font-bold uppercase tracking-[0.06em]">
                        Este usuario está ligado a registros activos
                      </p>
                      <p className="mt-0.5 font-sans text-xs leading-relaxed">
                        Revisa exactamente a qué está ligado antes de decidir si lo eliminas por completo o cancelas.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {inspection.links.staffRole && (
                      <LinkBlock
                        title="Permiso global en la plataforma"
                        consequence="Se eliminará este permiso global."
                      >
                        <li>Rol: {GLOBAL_ROLE_LABEL[inspection.links.staffRole]}</li>
                      </LinkBlock>
                    )}

                    {inspection.links.ownedEvents.length > 0 && (
                      <LinkBlock
                        title={`Creador de ${inspection.links.ownedEvents.length} evento(s)`}
                        consequence="Al eliminar por completo se borrarán estos eventos junto con todos sus proyectos, evaluaciones, huellas y archivos."
                        danger
                      >
                        {inspection.links.ownedEvents.map((ev) => (
                          <li key={ev.eventId}>
                            <span className="font-semibold">{ev.name}</span>
                            {ev.institution ? ` · ${ev.institution}` : ""} — {ev.projectsCount} proyecto(s),{" "}
                            {ev.evaluationsCount} evaluación(es)
                            {ev.resultsPublished ? " (resultados publicados)" : ""}
                          </li>
                        ))}
                      </LinkBlock>
                    )}

                    {inspection.links.ledProjects.length > 0 && (
                      <LinkBlock
                        title={`Líder de ${inspection.links.ledProjects.length} proyecto(s)`}
                        consequence="Al eliminar por completo se borrarán estos proyectos, sus entregas, logos, huellas y evaluaciones. Los demás integrantes quedarán libres en su evento."
                        danger
                      >
                        {inspection.links.ledProjects.map((proj) => (
                          <li key={`${proj.eventId}:${proj.projectId}`}>
                            <span className="font-semibold">{proj.title}</span> en {proj.eventName}
                            {proj.otherMembers.length > 0
                              ? ` · integrantes: ${proj.otherMembers.join(", ")}`
                              : ""}
                            {proj.filesCount > 0 || proj.hasLogo
                              ? ` · ${proj.filesCount} archivo(s)${proj.hasLogo ? " + logo" : ""}`
                              : ""}
                            {proj.evaluationsCount > 0 ? ` · ${proj.evaluationsCount} evaluación(es)` : ""}
                          </li>
                        ))}
                      </LinkBlock>
                    )}

                    {inspection.links.evaluationsByEvent.length > 0 && (
                      <LinkBlock
                        title="Evaluaciones registradas como juez"
                        consequence="Se eliminarán todas sus calificaciones y comentarios. Si el evento tiene resultados publicados, se recalcularán sin sus votos."
                      >
                        {inspection.links.evaluationsByEvent.map((ev) => (
                          <li key={ev.eventId}>
                            <span className="font-semibold">{ev.eventName}</span>: {ev.evaluationsCount} calificación(es) (
                            {ev.phases.map((p) => PHASE_LABEL[p as Phase] ?? p).join(", ")}) en{" "}
                            {ev.projectTitles.join(", ")}
                            {ev.resultsPublished ? " · resultados publicados" : ""}
                          </li>
                        ))}
                      </LinkBlock>
                    )}

                    {inspection.links.coOrganizerEvents.length > 0 && (
                      <LinkBlock
                        title={`Coorganizador en ${inspection.links.coOrganizerEvents.length} evento(s)`}
                        consequence="Se quitará de la lista de organizadores (el evento se conserva)."
                      >
                        {inspection.links.coOrganizerEvents.map((ev) => (
                          <li key={ev.eventId}>
                            <span className="font-semibold">{ev.name}</span>
                            {ev.institution ? ` · ${ev.institution}` : ""}
                          </li>
                        ))}
                      </LinkBlock>
                    )}

                    {inspection.links.judgeEvents.length > 0 && (
                      <LinkBlock
                        title={`Juez en ${inspection.links.judgeEvents.length} evento(s)`}
                        consequence="Se quitará de jueces y se eliminarán sus asignaciones en esos eventos."
                      >
                        {inspection.links.judgeEvents.map((ev) => (
                          <li key={ev.eventId}>
                            <span className="font-semibold">{ev.name}</span>
                            {ev.assignedProjectsCount > 0
                              ? ` (${ev.assignedProjectsCount} asignación(es))`
                              : ""}
                          </li>
                        ))}
                      </LinkBlock>
                    )}

                    {inspection.links.memberProjects.length > 0 && (
                      <LinkBlock
                        title={`Integrante en ${inspection.links.memberProjects.length} proyecto(s)`}
                        consequence="Se quitará al usuario del equipo y del padrón (el proyecto continúa con su líder)."
                      >
                        {inspection.links.memberProjects.map((proj) => (
                          <li key={`${proj.eventId}:${proj.projectId}`}>
                            <span className="font-semibold">{proj.title}</span> en {proj.eventName} (líder:{" "}
                            {displayEmail(proj.leaderEmail)})
                          </li>
                        ))}
                      </LinkBlock>
                    )}

                    {inspection.links.orphanRosters.length > 0 && (
                      <LinkBlock
                        title="Padrón de participantes"
                        consequence="Se eliminará del registro de participantes."
                      >
                        {inspection.links.orphanRosters.map((item) => (
                          <li key={item.eventId}>{item.eventName}</li>
                        ))}
                      </LinkBlock>
                    )}
                  </div>
                </section>
              ) : (
                <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p className="font-sans text-xs leading-relaxed">
                    Este usuario no está ligado a ningún evento, proyecto, evaluación ni permiso especial.
                  </p>
                </div>
              )}

              <section className="rounded-2xl border border-line bg-paper p-4">
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                  Registros que se borrarán por completo
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 font-mono text-[11px] text-ink">
                  {recordItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              {inspection.hasLinks && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-red-600"
                    checked={confirmed}
                    disabled={deleting}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span className="font-sans leading-relaxed">
                    Revisé los vínculos anteriores y decido eliminar este usuario por completo sin dejar registro en
                    Firebase ni en Authentication.
                  </span>
                </label>
              )}

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 font-mono text-xs text-red-700">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button variant="outline" onClick={onCancel} disabled={deleting}>
                  No eliminar
                </Button>
                <Button
                  variant="danger"
                  loading={deleting}
                  disabled={inspection.hasLinks && !confirmed}
                  onClick={handleConfirmDelete}
                >
                  <Trash2 className="size-4" />
                  Eliminar por completo
                </Button>
              </div>
            </>
          )}
        </div>
  );
}

function LinkBlock({
  title,
  consequence,
  danger,
  children,
}: {
  title: string;
  consequence: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3 text-ink">
      <p className="font-display text-[11px] font-bold uppercase tracking-[0.05em]">{title}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 font-sans text-xs">{children}</ul>
      <p className={danger ? "mt-2 font-mono text-[11px] text-red-700" : "mt-2 font-mono text-[11px] text-muted"}>
        {consequence}
      </p>
    </div>
  );
}

function buildRecordSummary(inspection: UserDeletionInspection) {
  const { records } = inspection;
  const items: string[] = [];
  if (records.authAccounts.length > 0) {
    items.push(`Firebase Authentication (${records.authAccounts.length} cuenta(s))`);
  }
  if (records.userProfilesCount > 0) {
    items.push(`Perfil en Firestore users/ (${records.userProfilesCount})`);
  }
  if (records.staffRole) {
    items.push(`Permiso global en staff/ (${GLOBAL_ROLE_LABEL[records.staffRole]})`);
  }
  if (records.staffUpdatedByCount > 0) {
    items.push(`Referencias updatedBy en staff/ (${records.staffUpdatedByCount})`);
  }
  if (records.invitationDeliveriesCount + records.invitationLimitsCount > 0) {
    items.push(
      `Registros de invitaciones (${records.invitationDeliveriesCount} envío(s), ${records.invitationLimitsCount} límite(s))`,
    );
  }
  if (records.withdrawnMarkersCount + records.withdrawalReceiptsCount > 0) {
    items.push(
      `Registros de bajas previas (${records.withdrawnMarkersCount + records.withdrawalReceiptsCount})`,
    );
  }
  if (records.storageFilesCount > 0) {
    items.push(`Archivos y logos en almacenamiento (${records.storageFilesCount})`);
  }
  if (items.length === 0) {
    items.push("Referencias en eventos, proyectos o evaluaciones indicadas arriba");
  }
  return items;
}
