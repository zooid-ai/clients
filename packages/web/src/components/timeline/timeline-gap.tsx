import { Loader2, MoreHorizontal } from "lucide-react";

/**
 * Marks a hole in the timeline where messages exist on the server but were
 * never delivered to this client — typically because the tab was idle long
 * enough that the reconnect sync came back gapped.
 *
 * It sits inline, at the boundary itself, rather than reusing the "Load more"
 * button at the top of the panel: the missing messages are in the middle of
 * the conversation, and a control at the top gives no clue that it is what
 * fills them in.
 */
export function TimelineGap({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-2" data-testid="timeline-gap">
      <div className="h-px flex-1 border-t border-dashed border-border" />
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-label="Load missing messages"
        title="Some messages weren't loaded here"
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:border-solid hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <MoreHorizontal className="h-3 w-3" />
        )}
        {loading ? "Loading…" : "Load messages"}
      </button>
      <div className="h-px flex-1 border-t border-dashed border-border" />
    </div>
  );
}
