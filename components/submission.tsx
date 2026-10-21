"use client";

import { ExternalLink, FileCheck2, Fingerprint, Link2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { removeSubmissionFile, uploadSubmissionFile } from "@/lib/data";
import { storageEnabled } from "@/lib/firebase";
import { sha256File } from "@/lib/similarity";
import type { FileItem, LinkItem, Phase, Submission } from "@/lib/types";
import { PHASE_LABEL } from "@/lib/types";
import { formatBytes, formatDate, safeUrl } from "@/lib/utils";
import { Badge, Button, Field, Input, Textarea, firestoreErrorMessage, useToast } from "./ui";

const MAX_FILE_MB = 200;

const LINK_PRESETS = ["Repositorio", "Video demo", "Presentación", "Documento", "Demo en línea", "Diseño (Figma)"];

export function SubmissionView({ submission, phase }: { submission: Submission | null; phase: Phase }) {
  if (!submission) {
    return (
      <p className="rounded-2xl bg-paper p-4 font-mono text-xs text-ink/60">
        El equipo aún no entrega su {PHASE_LABEL[phase].toLowerCase()}.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="green">Entregado</Badge>
        {submission.submittedAt && (
          <span className="font-mono text-[11px] text-ink/55">Última actualización: {formatDate(submission.submittedAt)}</span>
        )}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed">{submission.description}</p>
      {submission.links.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          {submission.links.map((l, i) => (
            <a
              key={i}
              href={safeUrl(l.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-ink/10 px-3.5 py-3 hover:border-ink/30"
            >
              <Link2 className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{l.label || "Enlace"}</span>
                <span className="block truncate font-mono text-[10px] text-ink/50">{l.url}</span>
              </span>
              <ExternalLink className="size-3.5 shrink-0 opacity-50" />
            </a>
          ))}
        </div>
      )}
      {submission.files.length > 0 && <FileList files={submission.files} />}
    </div>
  );
}

function FileList({ files, onRemove }: { files: FileItem[]; onRemove?: (index: number) => void }) {
  return (
    <ul className="space-y-2">
      {files.map((f, i) => (
        <li key={`${f.sha256}-${i}`} className="flex items-center gap-3 rounded-xl bg-paper px-3.5 py-3">
          {f.url ? <FileCheck2 className="size-4 shrink-0" /> : <Fingerprint className="size-4 shrink-0" />}
          <span className="min-w-0 flex-1">
            {f.url ? (
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium underline">
                {f.name}
              </a>
            ) : (
              <span className="block truncate text-sm font-medium">{f.name}</span>
            )}
            <span className="block truncate font-mono text-[10px] text-ink/50">
              {formatBytes(f.size)} · {f.url ? "archivo subido" : "solo huella digital"} · {f.sha256.slice(0, 12)}…
            </span>
          </span>
          {onRemove && (
            <Button type="button" variant="ghost" size="sm" aria-label={`Quitar ${f.name}`} onClick={() => onRemove(i)}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SubmissionEditor({
  eventId,
  projectId,
  phase,
  initial,
  userEmail,
  onSave,
  onCancel,
}: {
  eventId: string;
  projectId: string;
  phase: Phase;
  initial: Submission | null;
  userEmail: string;
  onSave: (submission: Submission) => Promise<void>;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [links, setLinks] = useState<LinkItem[]>(initial?.links.length ? initial.links : [{ label: "Repositorio", url: "" }]);
  const [files, setFiles] = useState<FileItem[]>(initial?.files ?? []);
  const [processing, setProcessing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast(`${file.name} supera ${MAX_FILE_MB} MB. Compártelo como enlace.`, "error");
        continue;
      }
      setProcessing(file.name);
      try {
        const sha256 = await sha256File(file);
        let uploaded: { url: string; path: string } | undefined;
        if (storageEnabled) uploaded = await uploadSubmissionFile(eventId, projectId, phase, file);
        setFiles((f) => [...f, { name: file.name, size: file.size, type: file.type, sha256, ...uploaded }]);
      } catch (err) {
        toast(firestoreErrorMessage(err), "error");
      }
    }
    setProcessing(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const cleanLinks = links
      .filter((l) => l.url.trim())
      .map((l) => ({ label: l.label.trim() || "Enlace", url: safeUrl(l.url) }));
    if (links.some((l) => l.url.trim() && !safeUrl(l.url))) return setError("Revisa los enlaces: alguno no es válido.");
    if (description.trim().length < 20) return setError("Describe la entrega en al menos 20 caracteres.");
    if (!cleanLinks.length && !files.length) return setError("Agrega al menos un enlace o un archivo.");
    setBusy(true);
    try {
      // Borra de Storage los archivos que se quitaron
      const removed = (initial?.files ?? []).filter((f) => !files.some((x) => x.path && x.path === f.path));
      await onSave({ description: description.trim(), links: cleanLinks, files, submittedAt: null, submittedBy: userEmail });
      await Promise.all(removed.map(removeSubmissionFile));
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field
        label={`Describe tu ${PHASE_LABEL[phase].toLowerCase()}`}
        htmlFor={`desc-${phase}`}
        hint={phase === "prototype" ? "Qué funciona ya, qué falta y cómo lo probaron." : "Qué entregan, cómo se usa y qué resultados obtuvieron."}
      >
        <Textarea id={`desc-${phase}`} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
      </Field>

      <div className="space-y-2">
        <p className="font-mono text-xs font-medium text-ink/80">Enlaces</p>
        {links.map((l, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[180px_1fr_auto]">
            <Input
              aria-label="Tipo de enlace"
              list="link-presets"
              value={l.label}
              onChange={(e) => setLinks((ls) => ls.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
            />
            <Input
              aria-label="URL"
              placeholder="https://github.com/equipo/proyecto"
              inputMode="url"
              value={l.url}
              onChange={(e) => setLinks((ls) => ls.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))}
            />
            <Button type="button" variant="ghost" aria-label="Quitar enlace" onClick={() => setLinks((ls) => ls.filter((_, idx) => idx !== i))}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <datalist id="link-presets">
          {LINK_PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        {links.length < 8 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setLinks((ls) => [...ls, { label: "", url: "" }])}>
            <Plus className="size-4" /> Agregar enlace
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <p className="font-mono text-xs font-medium text-ink/80">Archivos</p>
        <p className="font-mono text-[11px] leading-relaxed text-ink/55">
          {storageEnabled
            ? `Se suben a la nube (máx. ${MAX_FILE_MB} MB c/u). También guardamos su huella para detectar copias.`
            : "Selecciona tu APK, ZIP de código, PDF o video final. No se sube: solo guardamos su huella digital (SHA-256) para detectar si alguien entrega exactamente el mismo archivo. Comparte el archivo con un enlace de Drive arriba."}
        </p>
        {files.length > 0 && <FileList files={files} onRemove={(i) => setFiles((f) => f.filter((_, idx) => idx !== i))} />}
        <input ref={fileInput} type="file" multiple className="sr-only" id={`file-${phase}`} onChange={(e) => addFiles(e.target.files)} />
        <label
          htmlFor={`file-${phase}`}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-ink/20 px-4 py-6 text-center hover:border-ink/40"
        >
          {processing ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          <span className="font-mono text-xs">{processing ? `Procesando ${processing}…` : "Toca para elegir archivos"}</span>
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={busy} disabled={!!processing}>
          {initial ? "Guardar cambios" : `Entregar ${PHASE_LABEL[phase].toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
