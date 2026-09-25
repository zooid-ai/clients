import { MatrixClientPeg } from "@/client/peg";
import { UserAvatar } from "@/components/user-avatar";
import { useEditedContent } from "@/hooks/use-edited-content";
import { useSafeNavigate } from "@/hooks/use-safe-navigate";
import { useUserName } from "@/hooks/use-user-name";
import { threadTargetPath } from "@/lib/matrix/permalinks";
import type { QuoteRef } from "@/lib/matrix/quote";
import { senderColor } from "@/lib/sender";
import { FormattedMessageBody } from "./formatted-message-body";
import { MessageTimestamp } from "./message-timestamp";
import { TruncatedBody } from "./truncated-body";

export interface QuoteCardViewProps {
  senderId: string;
  senderName: string;
  sourceRoomId: string;
  /** Shown as "in <label>" when the source is another room. */
  roomLabel?: string | null;
  ts: number;
  body: string;
  formattedBody?: string;
  deleted?: boolean;
  replyCount?: number;
  onOpen?: () => void;
}

export function QuoteCardView(p: QuoteCardViewProps) {
  const interactive = Boolean(p.onOpen);
  return (
    <div
      role={interactive ? "link" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`Quoted message from ${p.senderName}`}
      onClick={p.onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") p.onOpen?.();
      }}
      className={`mt-1 rounded-md border-l-2 border-muted-foreground/40 bg-muted/30 px-3 py-2 ${interactive ? "cursor-pointer hover:bg-muted/50" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <UserAvatar userId={p.senderId} size="xs" />
        <span className="truncate font-semibold" style={{ color: senderColor(p.senderId) }}>
          {p.senderName}
        </span>
        {p.roomLabel && <span className="truncate">in {p.roomLabel}</span>}
        <MessageTimestamp ts={p.ts} />
      </div>
      <div className="mt-1 text-sm">
        {p.deleted ? (
          <p className="italic text-muted-foreground">Original message deleted</p>
        ) : (
          <TruncatedBody>
            {p.formattedBody ? (
              <FormattedMessageBody html={p.formattedBody} roomId={p.sourceRoomId} />
            ) : (
              <p className="whitespace-pre-wrap break-words text-foreground">{p.body}</p>
            )}
          </TruncatedBody>
        )}
      </div>
      {p.replyCount ? (
        <div className="mt-1 text-xs text-primary">
          {p.replyCount} {p.replyCount === 1 ? "reply" : "replies"} · View thread
        </div>
      ) : null}
    </div>
  );
}

/** Live source when sync already has it; otherwise the send-time snapshot. Never fetches. */
export function QuoteCard({ quote, currentRoomId }: { quote: QuoteRef; currentRoomId: string }) {
  const navigate = useSafeNavigate();
  const senderName = useUserName(quote.sender, quote.room_id);
  const edited = useEditedContent(quote.room_id, quote.event_id);
  const sourceRoom = MatrixClientPeg.safeGet()?.getRoom(quote.room_id) ?? null;
  const live = sourceRoom?.findEventById(quote.event_id) ?? null;
  const deleted = live?.isRedacted() ?? false;
  const liveContent = (edited ?? live?.getContent() ?? null) as QuoteRef["snapshot"] | null;
  const src = typeof liveContent?.body === "string" ? liveContent : quote.snapshot;
  const formattedBody =
    src.format === "org.matrix.custom.html" && src.formatted_body ? src.formatted_body : undefined;
  const roomLabel = quote.room_id === currentRoomId ? null : (sourceRoom?.name ?? "another room");
  const path = threadTargetPath({ roomId: quote.room_id, threadId: quote.thread_id, eventId: quote.event_id });
  return (
    <QuoteCardView
      senderId={quote.sender}
      senderName={senderName}
      sourceRoomId={quote.room_id}
      roomLabel={roomLabel}
      ts={quote.origin_server_ts}
      body={src.body}
      formattedBody={formattedBody}
      deleted={deleted}
      replyCount={quote.thread?.reply_count}
      onOpen={() => navigate(path)}
    />
  );
}
