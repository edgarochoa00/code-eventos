import Link from "next/link";
import { LEGAL_LINKS, PRODUCT_VERSION } from "@/lib/legal";
import { cn } from "@/lib/utils";

/** Enlaces a la información del servicio y versión de la app. */
export function LegalLinks({
  showVersion = true,
  align = "center",
  className,
}: {
  showVersion?: boolean;
  align?: "center" | "start";
  className?: string;
}) {
  return (
    <nav
      aria-label="Información legal y versión"
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px]",
        align === "center" ? "justify-center" : "justify-start",
        className,
      )}
    >
      {LEGAL_LINKS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex min-h-11 items-center text-ink/55 underline-offset-2 hover:text-ink hover:underline sm:min-h-0 sm:py-1"
        >
          {item.label}
        </Link>
      ))}
      {showVersion && <span className="text-[10px] text-ink/40">v{PRODUCT_VERSION}</span>}
    </nav>
  );
}
