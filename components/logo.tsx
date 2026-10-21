import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="C.O.D.E inicio">
      <span className="grid size-8 place-items-center rounded-lg bg-night font-display text-lg font-bold text-lime ring-1 ring-white/10">C</span>
      <span className="font-mono text-sm font-medium tracking-tight">C.O.D.E</span>
    </Link>
  );
}
