import { useState, useRef, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { MatrixEvent } from "matrix-js-sdk";
import { MessageSquare, TriangleAlertIcon } from "lucide-react";
import { senderColor, splitMentions } from "@/lib/sender";
import { UserAvatar } from "@/components/user-avatar";
import { MatrixClientPeg } from "@/client/peg";
import { useSyncExternalStore } from "react";
import { usePresence } from "@/hooks/use-presence";
import { useReactions } from "@/hooks/use-reactions";
import { useThreadPreview } from "@/hooks/use-timeline";
import { useUserName } from "@/hooks/use-user-name";
import { useEditedContent } from "@/hooks/use-edited-content";
import { ZooidEventType } from "@/events/zooid-events";
import { FormattedMessageBody } from "./formatted-message-body";
import { MessageTile } from "./message-tile";
import { ReactionPicker } from "./reaction-picker";
import { ReactionsRow } from "./reactions-row";
import { ReadReceiptsRow } from "./read-receipts-row";
import {
  EditButton,
  DeleteButton,
  DeleteConfirmDialog,
  InlineEdit,
  sendEditEvent,
} from "./message-actions";

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
  const c = event.getContent() as {
    msgtype?: string;
    body?: string;
    format?: string;
    formatted_body?: string;
    message?: string;
  };
  const sender = event.getSender() ?? "?";
  const roomId = event.getRoomId() ?? "";
  const name = useUserName(sender, roomId);

  if (event.getType() === ZooidEventType.Error) {
    const message = typeof c.message === "string" ? c.message : "Agent error";
    return (
      <div className="flex items-center gap-1.5 text-sm leading-5 text-muted-foreground">
        <TriangleAlertIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="shrink-0 font-semibold" style={{ color: senderColor(sender) }}>
          {name}
        </span>
        <span className="line-clamp-1 min-w-0 flex-1">{message}</span>
      </div>
    );
  }

  const hasFormatted =
    c.format === "org.matrix.custom.html" &&
    typeof c.formatted_body === "string" &&
    c.formatted_body.length > 0;
  if (c.msgtype !== "m.text" && c.msgtype !== "m.notice") return null;
  return (
    <div className="flex items-baseline gap-1.5 text-sm leading-5">
      <span className="shrink-0 font-semibold" style={{ color: senderColor(sender) }}>
        {name}
      </span>
      {hasFormatted ? (
        <div className="line-clamp-2 min-w-0 flex-1 text-foreground/80">
          <FormattedMessageBody html={c.formatted_body!} roomId={roomId} />
        </div>
      ) : (
        <span className="line-clamp-2 min-w-0 flex-1 text-foreground/80">{c.body ?? ""}</span>
      )}
    </div>
  );
}

export function TextMessage({
  event,
  onReplyInThread,
  onViewThread,
  disableThreadAffordances,
}: TextMessageProps) {
  const client = useSyncExternalStore(
    (cb) => MatrixClientPeg.subscribe(cb),
    () => MatrixClientPeg.safeGet(),
    () => null,
  );
  const c = event.getContent() as {
    msgtype?: string;
    body?: string;
    format?: string;
    formatted_body?: string;
  };
  const sender = event.getSender() ?? "?";
  const eventId = event.getId() ?? "";
  const roomId = event.getRoomId() ?? "";
  const senderName = useUserName(sender, roomId);
  const myUserId = client?.getUserId() ?? "";
  const isMine = sender === myUserId;
  const edited = useEditedContent(roomId, eventId);
  const displayBody = edited?.body ?? c.body ?? "";
  const displayFormattedBody =
    typeof edited?.formatted_body === "string" ? edited.formatted_body : c.formatted_body;
  const hasFormatted =
    (edited
      ? c.format === "org.matrix.custom.html" && typeof displayFormattedBody === "string" && displayFormattedBody.length > 0
      : c.format === "org.matrix.custom.html" && typeof c.formatted_body === "string" && c.formatted_body.length > 0);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selected, setSelected] = useState(false);
  const isMobile = useIsMobile();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setSelected(false);
      }
    };
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, [selected]);

  const { events: threadEvents, totalCount } = useThreadPreview(
    roomId,
    disableThreadAffordances ? "" : eventId,
  );
  const reactions = useReactions(roomId, eventId);
  if (c.msgtype !== "m.text" && c.msgtype !== "m.notice") return null;

  // Tombstone for redacted messages
  if (event.isRedacted()) {
    return (
      <MessageTile
        className="hover:bg-muted/30"
        avatar={<AvatarWithPresence userId={sender} />}
        senderName={senderName}
        senderColor={senderColor(sender)}
        senderTitle={sender}
      >
        <p className="text-sm italic text-muted-foreground">Message deleted</p>
      </MessageTile>
    );
  }

  const room = client?.getRoom(roomId);
  const canRedact =
    isMine ||
    (room?.currentState.maySendRedactionForEvent?.(event, myUserId) ?? false);

  async function handleSaveEdit(value: string) {
    if (client) await sendEditEvent(client, roomId, eventId, value);
    setEditing(false);
  }

  async function handleConfirmDelete() {
    await client?.redactEvent(roomId, eventId);
    setConfirmDelete(false);
  }

  const actions = (
    <div className={`absolute -top-3 right-2 z-10 transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto ${selected ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
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
        {isMine && <EditButton onClick={() => setEditing(true)} />}
        {canRedact && <DeleteButton onClick={() => setConfirmDelete(true)} />}
      </div>
    </div>
  );

  return (
    <MessageTile
      ref={wrapperRef}
      data-selected={selected || undefined}
      onClick={() => { if (isMobile) setSelected(true); }}
      className="hover:bg-muted/30 data-[selected]:bg-muted/30"
      avatar={<AvatarWithPresence userId={sender} />}
      senderName={senderName}
      senderColor={senderColor(sender)}
      senderTitle={sender}
      actions={actions}
    >
        {editing ? (
          <InlineEdit
            initialValue={displayBody}
            onSave={handleSaveEdit}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            {hasFormatted ? (
              <FormattedMessageBody html={displayFormattedBody!} roomId={roomId} />
            ) : (
              <p className="min-w-0 whitespace-pre-wrap break-words leading-6 text-foreground text-sm">
                {splitMentions(displayBody).map((seg, i) =>
                  seg.userId ? (
                    <MentionPill key={i} userId={seg.userId} roomId={roomId} />
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
                {edited && (
                  <span className="ml-1 text-xs text-muted-foreground">(edited)</span>
                )}
              </p>
            )}
          </>
        )}

        <ReactionsRow roomId={roomId} eventId={eventId} reactions={reactions} />
        <ReadReceiptsRow roomId={roomId} eventId={eventId} />

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

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={handleConfirmDelete}
      />
    </MessageTile>
  );
}
