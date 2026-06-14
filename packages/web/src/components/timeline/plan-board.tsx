import { ChevronDown, ChevronUp, ListChecks, X } from "lucide-react";
import type { PlanSnapshot } from "@/hooks/use-plan";

interface PlanBoardProps {
  plan: PlanSnapshot | null;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  onDismiss?: () => void;
}

export function PlanBoard({ plan, collapsed, onCollapse, onExpand, onDismiss }: PlanBoardProps) {
  if (!plan || plan.entries.length === 0) return null;
  const done = plan.entries.filter((e) => e.status === "completed").length;
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5 shrink-0" />
        <span>Plan</span>
        <span className="tabular-nums">
          {done}/{plan.entries.length}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            aria-label={collapsed ? "Expand plan" : "Collapse plan"}
            onClick={collapsed ? onExpand : onCollapse}
            className="rounded p-0.5 hover:bg-muted"
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Dismiss plan"
            onClick={onDismiss}
            className="rounded p-0.5 hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {!collapsed && (
        <ul className="mt-1 space-y-0.5 text-sm">
          {plan.entries.map((e, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={statusBullet(e.status)} aria-label={e.status} />
              <span
                className={
                  e.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
                }
              >
                {e.content}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusBullet(status: string) {
  const base = "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ";
  switch (status) {
    case "completed":
      return base + "bg-emerald-500";
    case "in_progress":
      return base + "bg-amber-500 animate-pulse";
    case "failed":
    case "cancelled":
      return base + "bg-destructive";
    default:
      return base + "bg-muted-foreground/40";
  }
}
