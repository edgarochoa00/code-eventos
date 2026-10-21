import { Medal } from "lucide-react";
import Link from "next/link";
import type { ResultRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Leaderboard({
  rows,
  eventId,
  highlightId,
  linkable,
}: {
  rows: ResultRow[];
  eventId: string;
  highlightId?: string;
  linkable?: boolean;
}) {
  if (!rows.length) return <p className="font-mono text-xs text-ink/50">Sin calificaciones todavía.</p>;
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => {
        const content = (
          <>
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl font-mono text-xs font-bold",
                i === 0 ? "bg-lime" : i < 3 ? "bg-ink text-surface" : "bg-paper",
              )}
            >
              {i < 3 ? <Medal className="size-4" aria-label={`Lugar ${i + 1}`} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.title}</span>
              <span className="font-mono text-[10px] text-ink/50">
                {r.judges} juez{r.judges === 1 ? "" : "es"}
              </span>
            </span>
            <span className="font-display text-xl font-bold tabular-nums">{r.score.toFixed(1)}</span>
          </>
        );
        const cls = cn(
          "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
          r.projectId === highlightId ? "border-ink bg-lime/30" : "border-ink/5 bg-surface",
        );
        return (
          <li key={r.projectId}>
            {linkable ? (
              <Link href={`/eventos/${eventId}/proyectos/${r.projectId}`} className={cn(cls, "hover:border-ink/30")}>
                {content}
              </Link>
            ) : (
              <div className={cls}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
