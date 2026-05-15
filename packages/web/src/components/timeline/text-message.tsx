import type { MatrixEvent } from "matrix-js-sdk";
import { MessageSquare } from "lucide-react";
import { senderColor, splitMentions } from "@/lib/sender";
import { UserAvatar } from "@/components/user-avatar";
import { usePresence } from "@/hooks/use-presence";
import { useReactions } from "@/hooks/use-reactions";
import { useThreadPreview } from "@/hooks/use-timeline";
import { useUserName } from "@/hooks/use-user-name";
import { ReactionPicker } from "./reaction-picker";
import { ReactionsRow } from "./reactions-row";

function AvatarWithPresence({ userId }: { userId: string }) {
  const { presence } = usePresence(userId);
  return <UserAvatar userId={userId} size="sm" presence={presence} />;
}

function MentionPill({ userId, roomId }: { userId: string; roomId: string }) {
  const name = useUserName(userId, roomId);
  return (
    <span
      className="rounded-sm bg-primary/15 px-1 font-medium"
      style={{ color: senderColor(userId) }}
      title={userId}
    >
      @{name}
    </span>
  );
}

export interface TextMessageProps {
  event: MatrixEvent;
  onReplyInThread?: (eventId: string) => void;
  onViewThread?: (eventId: string) => void;
  /** When true, hide thread preview + "Reply in thread" button (used inside ThreadView). */
  disableThreadAffordances?: boolean;
}

function InlineReply({ event }: { event: MatrixEvent }) {
  const c = event.getContent() as { msgtype?: string; body?: string };
  const sender = event.getSender() ?? "?";
  const roomId = event.getRoomId() ?? "";
  const name = useUserName(sender, roomId);
  if (c.msgtype !== "m.text" && c.msgtype !== "m.notice") return null;
  return (
    <div className="text-sm leading-5">
      <span className="font-semibold" style={{ color: senderColor(sender) }}>
        {name}
      </span>
      <span className="text-foreground/80 ml-1.5">{c.body ?? ""}</span>
    </div>
  );
}

export function TextMessage({
  event,
  onReplyInThread,
  onViewThread,
  disableThreadAffordances,
}: TextMessageProps) {
  const c = event.getContent() as { msgtype?: string; body?: string };
  const sender = event.getSender() ?? "?";
  const body = c.body ?? "";
  const eventId = event.getId() ?? "";
  const roomId = event.getRoomId() ?? "";
  const senderName = useUserName(sender, roomId);

  // When disabled, pass an empty rootId so the hook short-circuits and returns no preview.
  const { events: threadEvents, totalCount } = useThreadPreview(
    roomId,
    disableThreadAffordances ? "" : eventId,
  );
  const reactions = useReactions(roomId, eventId);
  if (c.msgtype !== "m.text" && c.msgtype !== "m.notice") return null;

  return (
    <div className="group relative flex gap-2 py-1.5 hover:bg-muted/30">
      <div className="mt-0.5 shrink-0">
        <AvatarWithPresence userId={sender} />
      </div>
      <div className="min-w-0 flex-1">
        <span
          className="font-semibold text-sm leading-6"
          style={{ color: senderColor(sender) }}
          title={sender}
        >
          {senderName}
        </span>
        <p className="min-w-0 whitespace-pre-wrap break-words leading-6 text-foreground text-sm">
          {splitMentions(body).map((seg, i) =>
            seg.userId ? (
              <MentionPill key={i} userId={seg.userId} roomId={roomId} />
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>

        <ReactionsRow roomId={roomId} eventId={eventId} reactions={reactions} />

        {!disableThreadAffordances && totalCount > 0 && (
          <div className="mt-2 pl-3 border-l-2 border-muted-foreground/25 space-y-1">
            {totalCount > 3 && (
              <button
                type="button"
                onClick={() => onViewThread?.(eventId)}
                className="text-xs text-primary hover:underline block"
              >
                View thread ({totalCount} events)
              </button>
            )}
            {threadEvents.map((reply) => (
              <InlineReply key={reply.getId()} event={reply} />
            ))}
          </div>
        )}

        {!disableThreadAffordances && (
          <button
            type="button"
            aria-label="Reply in thread"
            onClick={() => onReplyInThread?.(eventId)}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Reply in thread
          </button>
        )}
      </div>

      <div className="pointer-events-none absolute -top-3 right-2 z-10 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-1 shadow-sm">
          <ReactionPicker roomId={roomId} eventId={eventId} />
          {!disableThreadAffordances && (
            <button
              type="button"
              aria-label="Reply"
              onClick={() => onReplyInThread?.(eventId)}
              className="inline-flex items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MessageSquare className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
