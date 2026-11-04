"use client";

import { Download, FileCheck2, FileClock, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { isUploadedFile, MAX_FILE_MB, MAX_SUBMISSION_FILES, validateFileSize } from "@/lib/submission-files";
import { downloadSubmissionFile, removeSubmissionFile, uploadSubmissionFile } from "@/lib/submission-storage";
import { sha256File } from "@/lib/similarity";
import type { FileItem, Phase, Submission } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";
import { Badge, Button, Field, Textarea, firestoreErrorMessage, useToast } from "./ui";

export function SubmissionView({ submission, label }: { submission: Submission | null; label: string }) {
  const generic = label.toLowerCase() === "entrega";
  if (!submission) {
    return (
      <p className="rounded-2xl bg-paper p-4 font-mono text-xs text-muted">
        {generic ? "El equipo aún no ha enviado su entrega." : `El equipo aún no ha enviado esta entrega: ${label}.`}
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="green">Entregado</Badge>
        {submission.submittedAt && (
          <span className="font-mono text-[11px] text-muted">Última actualización: {formatDate(submission.submittedAt)}</span>
        )}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed">{submission.description}</p>
      {submission.files.length > 0 && <FileList entries={submission.files.map(item => ({ item }))} />}
      {!submission.files.some(isUploadedFile) && (
        <p className="rounded-xl bg-amber-50 p-3 font-mono text-xs text-amber-800">
          Esta entrega anterior no tiene archivos almacenados. El equipo debe editarla y subir sus archivos directamente.
        </p>
      )}
    </div>
  );
}

type Entry = { item: FileItem; local?: File };

function FileList({ entries, onRemove, disabled }: { entries: Entry[]; onRemove?: (index: number) => void; disabled?: boolean }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState<number | null>(null);

  async function download(file: FileItem, index: number) {
    setDownloading(index);
    try { await downloadSubmissionFile(file); }
    catch (error) { toast(firestoreErrorMessage(error), "error"); }
    finally { setDownloading(null); }
  }

  return (
    <ul className="space-y-2">
      {entries.map(({ item: file, local }, index) => {
        const uploaded = isUploadedFile(file);
        return (
          <li key={`${file.sha256}-${index}`} className="flex items-center gap-3 rounded-xl bg-paper px-3.5 py-3">
            {uploaded ? <FileCheck2 className="size-4 shrink-0" /> : <FileClock className="size-4 shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{file.name}</span>
              <span className="block font-mono text-[10px] text-muted">
                {formatBytes(file.size)} · {uploaded ? "Archivo subido" : local ? "Listo para subir al guardar" : "Debes volver a subirlo"}
              </span>
            </span>
            {uploaded && (
              <Button type="button" variant="ghost" size="sm" aria-label={`Descargar ${file.name}`}
                loading={downloading === index} disabled={disabled || downloading !== null} onClick={() => download(file, index)}>
                {downloading !== index && <Download className="size-4" />}
              </Button>
            )}
            {onRemove && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label={`Quitar ${file.name}`} onClick={() => onRemove(index)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SubmissionEditor({ eventId, projectId, phase, label, instructions, initial, userEmail, onSave, onCancel }: {
  eventId: string;
  projectId: string;
  phase: Phase;
  label: string;
  instructions?: string;
  initial: Submission | null;
  userEmail: string;
  onSave: (submission: Submission) => Promise<void>;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const operation = useRef(false);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [entries, setEntries] = useState<Entry[]>((initial?.files ?? []).map(item => ({ item })));
  const [processing, setProcessing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = busy || !!processing;

  async function addFiles(list: FileList | null) {
    if (!list?.length || operation.current) return;
    operation.current = true;
    let count = entries.length;
    try {
      for (const file of Array.from(list)) {
        if (count >= MAX_SUBMISSION_FILES) {
          toast(`Puedes adjuntar hasta ${MAX_SUBMISSION_FILES} archivos por entrega.`, "error");
          break;
        }
        setProcessing(`Preparando ${file.name}…`);
        try {
          validateFileSize(file.size);
          if (file.name.length > 255) throw new Error("El nombre del archivo es demasiado largo. Renómbralo antes de subirlo.");
          const sha256 = await sha256File(file);
          setEntries(current => [...current, { local: file, item: { name: file.name, size: file.size, type: file.type, sha256 } }]);
          count++;
        } catch (error) { toast(`${file.name}: ${firestoreErrorMessage(error)}`, "error"); }
      }
    } finally {
      operation.current = false;
      setProcessing(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (operation.current) return;
    setError("");
    if (description.trim().length < 20) return setError("Describe la entrega en al menos 20 caracteres.");
    if (!entries.length) return setError("Agrega al menos un archivo a la entrega.");
    if (entries.some(({ item, local }) => !local && item.storage !== "supabase")) {
      return setError("Quita los archivos de la versión anterior y vuelve a seleccionarlos para subirlos.");
    }
    operation.current = true;
    setBusy(true);
    const uploaded: FileItem[] = [];
    try {
      const files: FileItem[] = [];
      for (const { item, local } of entries) {
        if (!local) { files.push(item); continue; }
        setProcessing(`Subiendo ${item.name}…`);
        const stored = { ...item, ...await uploadSubmissionFile(eventId, projectId, phase, local) };
        uploaded.push(stored);
        files.push(stored);
      }
      setProcessing("Guardando entrega…");
      await onSave({ description: description.trim(), links: [], files, submittedAt: null, submittedBy: userEmail });
      // También evita duplicados si el formulario sigue abierto después del primer guardado.
      setEntries(files.map(item => ({ item })));
    } catch (error) {
      // Solo descarta archivos nuevos que no hayan quedado registrados en Firestore.
      await Promise.allSettled(uploaded.map(file => removeSubmissionFile(file, true)));
      setError(firestoreErrorMessage(error));
    } finally {
      operation.current = false;
      setProcessing(null);
      setBusy(false);
    }
  }

  const generic = label.toLowerCase() === "entrega";
  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-busy={locked}>
      <Field label={generic ? "Descripción de la entrega" : `Descripción de la entrega: ${label}`} htmlFor={`desc-${phase}`} hint={instructions}>
        <Textarea id={`desc-${phase}`} rows={5} value={description} disabled={locked} onChange={event => setDescription(event.target.value)} maxLength={5000} />
      </Field>
      <div className="space-y-2">
        <p className="font-mono text-xs font-medium text-ink/80">Archivos de la entrega</p>
        <p className="font-mono text-[11px] leading-relaxed text-muted">
          Adjunta tu APK, código en ZIP, PDF, presentación o video. Los archivos se suben al guardar la entrega.
          Máximo {MAX_FILE_MB} MB por archivo y {MAX_SUBMISSION_FILES} archivos por entrega.
        </p>
        {entries.length > 0 && <FileList entries={entries} disabled={locked} onRemove={index => setEntries(current => current.filter((_, i) => i !== index))} />}
        <input ref={fileInput} type="file" multiple disabled={locked || entries.length >= MAX_SUBMISSION_FILES}
          className="hidden" aria-label={generic ? "Archivos de la entrega" : `Archivos de la entrega: ${label}`} id={`file-${phase}`} onChange={event => void addFiles(event.target.files)} />
        <Button type="button" variant="outline" className="h-auto w-full flex-col border-dashed py-6"
          disabled={locked || entries.length >= MAX_SUBMISSION_FILES} onClick={() => fileInput.current?.click()}>
          <Upload className="size-5" /> Toca para elegir archivos
        </Button>
        {processing && (
          <p role="status" className="flex items-center gap-2 font-mono text-xs text-muted">
            <Loader2 className="size-4 animate-spin" /> {processing}
          </p>
        )}
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <Button type="button" variant="ghost" disabled={locked} onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" loading={busy} disabled={locked}>
          {initial ? "Guardar cambios" : generic ? "Guardar entrega" : `Entregar: ${label}`}
        </Button>
      </div>
    </form>
  );
}
