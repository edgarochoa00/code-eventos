"use client";

import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { LOGO_TYPES, validateLogoFile } from "@/lib/project-logo";
import { projectLogoRequest } from "@/lib/project-logo-storage";
import type { ProjectDoc } from "@/lib/types";
import { Button } from "./ui";

export function ProjectLogo({ project, canEdit = false, compact = false }: { project: ProjectDoc; canEdit?: boolean; compact?: boolean }) {
  const { user } = useAuth();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const file = preview?.file;
  const setFile = (selected: File | null) => setPreview(selected ? { file: selected, url: URL.createObjectURL(selected) } : null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const path = project.logo?.path;
  const key = `${user?.uid}:${project.eventId}:${project.id}:${path}:${retry}`;

  useEffect(() => {
    if (!path || !user) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    projectLogoRequest(project.eventId, project.id, "GET", undefined, false, controller.signal)
      .then(response => response.blob()).then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setImage({ key, url: objectUrl });
      }).catch(() => { if (!controller.signal.aborted) setFailedKey(key); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [key, path, project.eventId, project.id, user]);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview.url); };
  }, [preview]);

  async function save(remove = false) {
    if (busy || (!remove && !file)) return;
    setBusy(true);
    setError("");
    try {
      await projectLogoRequest(project.eventId, project.id, remove ? "DELETE" : "POST", remove ? undefined : file!);
      setFile(null);
      if (input.current) input.current.value = "";
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar el logo."); }
    finally { setBusy(false); }
  }

  if (!path && !canEdit) return null;
  const failed = failedKey === key;
  const src = file && preview?.file === file ? preview.url : !failed && image?.key === key ? image.url : undefined;

  return (
    <div className={compact ? "shrink-0" : "mb-5 flex flex-wrap items-center gap-5"}>
      {src ? (
        // La imagen privada se obtiene con la sesión Firebase y vive en una URL local temporal.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Logo de ${project.title || "tu marca"}`} onError={() => setFailedKey(key)}
          className={`${compact ? "size-16" : "size-24 sm:size-28"} -rotate-6 object-contain [filter:drop-shadow(2px_0_0_white)_drop-shadow(-2px_0_0_white)_drop-shadow(0_2px_0_white)_drop-shadow(0_-2px_0_white)_drop-shadow(0_5px_4px_#0003)]`} />
      ) : (canEdit || path) && (
        <div aria-label={path ? "Cargando logo" : "Logo opcional"} className={`${compact ? "size-16" : "size-24"} grid shrink-0 place-items-center rounded-2xl border-2 border-dashed border-line bg-paper`}>
          <ImagePlus className="size-6 text-muted" />
        </div>
      )}
      {!compact && (canEdit || failed) && <div className="min-w-0 flex-1 space-y-2">
        {canEdit && <>
          <p className="text-sm font-medium">Logo de tu marca <span className="font-normal text-muted">· opcional</span></p>
          <p className="max-w-md text-xs leading-relaxed text-muted">Aparecerá como sticker en tu proyecto. PNG, JPG o WebP, hasta 2 MB. Usa PNG con fondo transparente para conservar la forma de tu logo.</p>
          <input ref={input} id={inputId} type="file" accept={LOGO_TYPES.join(",")} className="sr-only" disabled={busy}
            onChange={event => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              try { validateLogoFile(selected); setFile(selected); setError(""); }
              catch (error) { setError((error as Error).message); event.target.value = ""; }
            }} aria-label="Seleccionar logo de tu marca" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}><ImagePlus className="size-3.5" /> {path || file ? "Cambiar logo" : "Agregar logo"}</Button>
            {file && <>
              <Button size="sm" loading={busy} onClick={() => save()}>Guardar logo</Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setFile(null); setError(""); if (input.current) input.current.value = ""; }}>Cancelar</Button>
            </>}
            {path && !file && <Button variant="ghost" size="sm" disabled={busy} onClick={() => save(true)}><Trash2 className="size-3.5" /> {busy ? "Quitando…" : "Quitar logo"}</Button>}
          </div>
          {file && <p className="break-all text-xs text-muted">{file.name} · Vista previa sin guardar</p>}
        </>}
        {failed && !file && <p className="text-xs text-muted">No se pudo cargar el logo. <button type="button" className="inline-flex items-center gap-1 underline" onClick={() => setRetry(value => value + 1)}><RefreshCw className="size-3" /> Reintentar</button></p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>}
    </div>
  );
}
