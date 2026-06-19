/**
 * Centered "rule with a label" divider used in the timeline to mark session
 * boundaries (e.g. `dev.zooid.session_reset` → "new session", or an agent
 * starting a session).
 */
export function SessionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-3 text-xs uppercase tracking-wider text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      <span>{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
