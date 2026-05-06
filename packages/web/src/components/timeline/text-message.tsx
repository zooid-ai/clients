import type { MatrixEvent } from "matrix-js-sdk";
import { displayNameOf, senderColor, splitMentions } from "@/lib/sender";

export function TextMessage({ event }: { event: MatrixEvent }) {
  const c = event.getContent() as { msgtype?: string; body?: string };
  if (c.msgtype !== "m.text") return null;
  const sender = event.getSender() ?? "?";
  const body = c.body ?? "";
  return (
    <div className="group flex gap-3 py-1.5 hover:bg-muted/30">
      <span
        className="shrink-0 font-semibold leading-6"
        style={{ color: senderColor(sender) }}
        title={sender}
      >
        {displayNameOf(sender)}
      </span>
      <p className="min-w-0 whitespace-pre-wrap break-words leading-6 text-foreground">
        {splitMentions(body).map((seg, i) =>
          seg.userId ? (
            <span
              key={i}
              className="rounded-sm bg-primary/15 px-1 font-medium"
              style={{ color: senderColor(seg.userId) }}
              title={seg.userId}
            >
              @{displayNameOf(seg.userId)}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </p>
    </div>
  );
}
