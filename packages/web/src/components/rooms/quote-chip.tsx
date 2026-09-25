import { X } from "lucide-react";
import { MessageTimestamp } from "@/components/timeline/message-timestamp";
import type { QuoteDraft } from "@/lib/quote-draft-store";
import { senderColor } from "@/lib/sender";

export function QuoteChip({ draft, onRemove }: { draft: QuoteDraft; onRemove: () => void }) {
  return (
    <div
      aria-label="Quoted message"
      className="mb-2 flex items-start gap-2 rounded-md border-l-2 border-primary/60 bg-muted/40 px-2.5 py-1.5 text-xs"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="font-semibold" style={{ color: senderColor(draft.quote.sender) }}>
            {draft.senderName}
          </span>
          <MessageTimestamp ts={draft.quote.origin_server_ts} />
        </div>
        <p className="line-clamp-2 whitespace-pre-wrap text-foreground/80">{draft.quote.snapshot.body}</p>
      </div>
      <button
        type="button"
        aria-label="Remove quote"
        onClick={onRemove}
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
