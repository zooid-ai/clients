interface UnreadBadgeProps {
  total: number;
  highlight: number;
  /** Kept for backwards compatibility; size is now uniform across the sidebar. */
  compact?: boolean;
}

export function UnreadBadge({ total, highlight }: UnreadBadgeProps) {
  if (total <= 0) return null;
  const display = total > 99 ? "99+" : String(total);
  const tone =
    highlight > 0
      ? "bg-destructive text-destructive-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span
      aria-label={`${total} unread`}
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium tabular-nums ${tone}`}
    >
      {display}
    </span>
  );
}
