import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const APP_NAME = "Feria 2027";
export const APP_SUBTITLE = "TECNM CULIACÁN · SISTEMAS Y TICS";
export const APP_TAGLINE = "Feria 2027 · TECNM CULIACÁN";

export function Logo({
  href = "/",
  tone = "default",
  size = "sm",
}: {
  href?: string;
  tone?: "default" | "light";
  size?: "sm" | "md";
}) {
  const light = tone === "light";
  const imgSize = size === "md" ? 44 : 38;
  return (
    <Link
      href={href}
      className="group inline-flex min-w-0 items-center gap-2 sm:gap-2.5"
      aria-label={`${APP_NAME} · ${APP_SUBTITLE}`}
    >
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full bg-white p-0.5 shadow-xs transition group-hover:scale-[1.03]",
          light ? "ring-2 ring-white/25" : "ring-1 ring-ink/15",
          size === "md" ? "size-11" : "size-9.5",
        )}
      >
        <Image
          src="/logo.png"
          alt="Logo TECNM Culiacán · Sistemas Computacionales y TICs"
          width={imgSize}
          height={imgSize}
          className="size-full object-contain"
          priority
        />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "truncate font-display text-xs font-extrabold uppercase tracking-[0.06em] sm:text-base",
            light ? "text-white" : "text-ink",
          )}
        >
          {APP_NAME}
        </span>
        <span
          className={cn(
            "mt-1 truncate font-display text-[9px] font-bold uppercase tracking-[0.08em] sm:text-[10px] sm:tracking-[0.12em]",
            light ? "text-white/75" : "text-muted",
          )}
        >
          TECNM CULIACÁN
        </span>
      </span>
    </Link>
  );
}
