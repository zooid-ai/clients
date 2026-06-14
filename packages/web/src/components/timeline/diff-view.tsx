import type { DiffBlock } from "@/events/eco-zoon";
import { lineDiff } from "@/lib/line-diff";

function shortPath(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

export function DiffView({ diff }: { diff: DiffBlock }) {
  const rows = lineDiff(diff.oldText, diff.newText);
  return (
    <div className="mt-1 overflow-hidden rounded-md border border-border">
      <div className="bg-muted/50 px-2 py-1 font-mono text-xs text-foreground/80" title={diff.path}>
        {shortPath(diff.path)}
      </div>
      <pre className="overflow-auto text-xs leading-relaxed">
        {rows.map((r, i) => (
          <div
            key={i}
            data-diff-row={r.type}
            className={
              r.type === "add"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : r.type === "del"
                  ? "bg-destructive/10 text-destructive"
                  : "text-muted-foreground"
            }
          >
            <span className="select-none pl-2 pr-2 opacity-60">
              {r.type === "add" ? "+" : r.type === "del" ? "-" : " "}
            </span>
            {r.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
