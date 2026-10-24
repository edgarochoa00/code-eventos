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
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/* ---------- Botones ---------- */

type Variant = "primary" | "dark" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-lime text-coal hover:brightness-95 active:brightness-90",
  dark: "bg-ink text-surface hover:bg-ink/90",
  outline: "border border-ink/15 bg-surface text-ink hover:border-ink/40",
  ghost: "text-ink hover:bg-ink/5",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-13 px-6 text-sm",
};

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-mono font-medium transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

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
  return <div className={cn("rounded-3xl bg-surface p-5 sm:p-6", className)}>{children}</div>;
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-bold sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 font-mono text-xs text-ink/60">{subtitle}</p>}
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
  tone?: "neutral" | "lime" | "dark" | "red" | "amber" | "green";
  className?: string;
}) {
  const tones = {
    neutral: "bg-ink/5 text-ink/70",
    lime: "bg-lime text-coal",
    dark: "bg-ink text-surface",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[11px] font-medium",
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
    <div className="flex items-center justify-center gap-2 py-16 font-mono text-xs text-ink/60" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink/15 bg-surface/60 px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-lime text-coal">{icon}</div>}
      <p className="font-display text-lg font-bold">{title}</p>
      {text && <p className="mt-1 max-w-sm font-mono text-xs leading-relaxed text-ink/60">{text}</p>}
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
      <label htmlFor={htmlFor} className="block font-mono text-xs font-medium text-ink/80">
        {label}
      </label>
      {children}
      {hint && !error && <p className="font-mono text-[11px] text-ink/50">{hint}</p>}
      {error && <p className="font-mono text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-ink/10 bg-paper px-3.5 py-3 text-base text-ink placeholder:text-ink/35 outline-none transition focus:border-ink/40 focus:bg-surface sm:text-sm";

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
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 font-mono text-[11px] text-ink/55">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50",
          checked ? "bg-ink dark:bg-lime" : "bg-ink/15",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full shadow-sm transition-all",
            checked ? "left-6 bg-lime dark:bg-coal" : "left-1 bg-white",
          )}
        />
      </button>
    </div>
  );
}

/* ---------- Pestañas ---------- */

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
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
      <div className="inline-flex gap-1 rounded-2xl bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={value === t.id}
            onClick={(e) => {
              onChange(t.id);
              // En celular, desplaza la pestaña elegida a la vista
              e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            }}
            className={cn(
              "flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 font-mono text-xs transition",
              value === t.id ? "bg-ink text-surface" : "text-ink/60 hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className={cn("rounded-md px-1.5 text-[10px]", value === t.id ? "bg-lime text-coal" : "bg-ink/5")}>
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
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-2xl bg-paper p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-10 flex-1 whitespace-nowrap rounded-xl px-3 py-2 font-mono text-[11px] transition disabled:opacity-50",
            value === o.id ? "bg-ink text-surface" : "text-ink/60 hover:text-ink",
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
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-surface p-0 text-ink backdrop:bg-black/55 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
    >
      <div className="flex items-center justify-between border-b border-ink/5 px-5 py-4">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <button onClick={onClose} className="grid size-9 place-items-center rounded-lg hover:bg-ink/5" aria-label="Cerrar">
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
  if (code.startsWith("storage/")) return "No se pudo subir el archivo. ¿Está activado Firebase Storage?";
  if (!code && err instanceof Error && err.message) return err.message;
  return "Algo salió mal. Intenta de nuevo.";
}
