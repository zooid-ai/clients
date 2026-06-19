/**
 * Centered date chip inserted into the timeline between messages from different
 * calendar days (e.g. "Today", "Yesterday", "June 16, 2026").
 */
export function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-2">
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
