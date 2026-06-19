import { useNow } from "@/hooks/use-now";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/time";

/**
 * Subtle relative timestamp shown beside a message sender. The exact date and
 * time is available on hover/tap via the native `title` tooltip.
 */
export function MessageTimestamp({ ts, className }: { ts: number; className?: string }) {
  const now = useNow();
  return (
    <time
      dateTime={new Date(ts).toISOString()}
      title={formatAbsoluteTime(ts)}
      className={`text-xs font-normal text-muted-foreground ${className ?? ""}`}
    >
      {formatRelativeTime(ts, now)}
    </time>
  );
}
