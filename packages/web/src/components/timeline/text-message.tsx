import { useState } from "react";
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
import { EcoZoonEventType } from "@/events/eco-zoon";
import { FormattedMessageBody } from "./formatted-message-body";
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

  if (event.getType() === EcoZoonEventType.Error) {
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

  const { events: threadEvents, totalCount } = useThreadPreview(
    roomId,
    disableThreadAffordances ? "" : eventId,
  );
  const reactions = useReactions(roomId, eventId);
  if (c.msgtype !== "m.text" && c.msgtype !== "m.notice") return null;

  // Tombstone for redacted messages
  if (event.isRedacted()) {
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
          <p className="text-sm italic text-muted-foreground">Message deleted</p>
        </div>
      </div>
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
          {isMine && <EditButton onClick={() => setEditing(true)} />}
          {canRedact && <DeleteButton onClick={() => setConfirmDelete(true)} />}
        </div>
      </div>

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
