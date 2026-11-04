"use client";

import { Loader2, X } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/* ---------- Botones ---------- */

type Variant = "primary" | "dark" | "accent" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  accent:
    "border-2 border-lime bg-lime text-coal shadow-sm hover:border-sage hover:bg-sage",
  primary:
    "bg-[#0b1536] text-white border-2 border-[#0b1536] shadow-sm hover:bg-[#142459] active:bg-[#081029] dark:bg-[#cfe0ff] dark:text-[#0b1536] dark:border-[#cfe0ff] dark:hover:bg-[#b8d0fa]",
  dark:
    "bg-ink text-surface border-2 border-ink ring-1 ring-inset ring-surface/75 shadow-xs hover:bg-ink/90",
  outline:
    "border-2 border-ink bg-surface text-ink hover:bg-ink hover:text-surface",
  ghost:
    "border-2 border-transparent text-ink hover:border-ink/15 hover:bg-ink/5",
  danger:
    "bg-red-600 text-white border-2 border-red-600 ring-1 ring-inset ring-white/65 hover:bg-red-700",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-11 px-4 py-2 text-[11px]",
  md: "min-h-11 px-5 py-2.5 text-xs",
  lg: "min-h-12 px-6 py-3 text-xs sm:text-sm",
};

const base =
  "inline-flex max-w-full shrink-0 items-center justify-center gap-2 whitespace-normal rounded-full text-center font-display font-bold uppercase leading-snug tracking-[0.06em] transition-transform active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink [&>svg]:shrink-0";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, VARIANTS[variant], SIZES[size], className)}>
      {children}
    </Link>
  );
}

/* ---------- Contenedores ---------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("ui-panel min-w-0 rounded-3xl p-5 sm:p-6", className)}>{children}</div>;
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-extrabold uppercase tracking-[0.04em] sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 font-sans text-xs font-medium text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "lime" | "dark" | "red" | "amber" | "green" | "on-dark";
  className?: string;
}) {
  const tones = {
    neutral: "border border-line bg-field text-muted",
    "on-dark": "border border-white/30 bg-white/10 text-white",
    lime: "border border-coal/20 bg-lime text-coal",
    dark: "border border-ink bg-ink text-surface",
    red: "border border-red-300 bg-red-100 text-red-700",
    amber: "border border-amber-300 bg-amber-100 text-amber-800",
    green: "border border-emerald-300 bg-emerald-100 text-emerald-800",
  };
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 font-display text-[10px] font-bold uppercase leading-relaxed tracking-[0.06em] [&>svg]:shrink-0",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 font-display text-xs font-bold uppercase tracking-[0.08em] text-muted" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-line bg-surface px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-full border-2 border-coal/15 bg-lime text-coal">{icon}</div>}
      <p className="font-display text-lg font-extrabold uppercase tracking-[0.04em]">{title}</p>
      {text && <p className="mt-1 max-w-sm font-sans text-xs font-medium leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Formularios ---------- */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-display text-[11px] font-bold uppercase tracking-[0.08em] text-ink/85">
        {label}
      </label>
      {children}
      {hint && !error && <p className="font-sans text-[11px] font-medium text-muted">{hint}</p>}
      {error && <p className="font-sans text-[11px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}

const inputBase =
  "w-full min-w-0 rounded-2xl border-2 border-control bg-field px-4 py-3 font-sans text-base font-medium text-ink placeholder:text-muted outline-none transition focus:border-ink focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputBase, "h-11 py-0", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(inputBase, "resize-y leading-relaxed", className)} {...props} />;
  },
);

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="block font-display text-xs font-bold uppercase tracking-[0.06em]">
          {label}
        </label>
        {description && <p className="mt-0.5 font-sans text-[11px] font-medium text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-11 w-14 shrink-0 rounded-full border-2 transition disabled:opacity-50",
          checked ? "border-ink bg-ink dark:border-lime dark:bg-lime" : "border-muted bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-2 size-6 rounded-full shadow-sm transition-all",
            checked ? "left-6 bg-lime dark:bg-coal" : "left-1 bg-white",
          )}
        />
      </button>
    </div>
  );
}

/* ---------- Pestañas ---------- */

function navigateOptions(event: KeyboardEvent<HTMLButtonElement>, role: "tab" | "radio") {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const options = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(`[role="${role}"]:not(:disabled)`) ?? []);
  if (!options.length) return;
  const current = options.indexOf(event.currentTarget);
  const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
  event.preventDefault();
  options[next].focus();
  options[next].click();
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto pb-2" role="tablist">
      <div className="inline-flex gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-xs">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={value === t.id}
            tabIndex={value === t.id ? 0 : -1}
            onKeyDown={(e) => navigateOptions(e, "tab")}
            onClick={(e) => {
              onChange(t.id);
              // En celular, desplaza la pestaña elegida a la vista
              e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }}
            className={cn(
              "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 font-display text-xs font-bold uppercase tracking-[0.06em] transition-shadow",
              value === t.id
                ? "bg-ink text-surface shadow-sm"
                : "text-muted hover:bg-field hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-extrabold", value === t.id ? "bg-lime text-coal" : "bg-ink/10")}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Selector segmentado (opciones excluyentes) ---------- */

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-field p-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          tabIndex={value === o.id ? 0 : -1}
          onKeyDown={(e) => navigateOptions(e, "radio")}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-11 flex-1 rounded-xl px-3.5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.06em] transition-shadow disabled:opacity-50",
            value === o.id
              ? "bg-ink text-surface shadow-sm"
              : "text-muted hover:bg-surface hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="ui-panel m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl p-0 text-ink backdrop:bg-black/55 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <button onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-ink/5" aria-label="Cerrar">
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}

/* ---------- Avisos (toasts) ---------- */

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto max-w-md rounded-2xl px-4 py-3 font-mono text-xs shadow-lg",
              t.tone === "ok" ? "bg-ink text-surface" : "bg-red-600 text-white",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function ErrorNote({ code }: { code: string }) {
  const text =
    code === "permission-denied"
      ? "Sin permiso para leer estos datos."
      : code === "failed-precondition"
        ? "Falta un índice en Firestore (despliega firestore.indexes.json)."
        : "No se pudieron cargar los datos.";
  return <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700">{text}</p>;
}

export function firestoreErrorMessage(err: unknown) {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "permission-denied") return "No tienes permiso para esta acción (o la etapa está cerrada).";
  if (code === "unavailable") return "Sin conexión con el servidor.";
  if (code.startsWith("storage/")) return "No se pudo completar la operación con el archivo. Revisa tu conexión y tus permisos.";
  if (!code && err instanceof Error && err.message) return err.message;
  return "Algo salió mal. Intenta de nuevo.";
}
