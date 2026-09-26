import { useMemo, useState } from "react";
import { parseSlashCommand } from "@/lib/slash-commands";
import { buildQuoteContent } from "@/lib/matrix/quote";
import { setQuoteDraft, useQuoteDraft } from "@/lib/quote-draft-store";
import { QuoteChip } from "./quote-chip";
import { MessageInput, type MessageInputSubmit } from "./message-input";
import { useMatrixClient } from "../../hooks/use-matrix-client";
import { useThreadPreview } from "../../hooks/use-timeline";
import { useTyping } from "../../hooks/use-typing";
import { useMediaUpload } from "../../hooks/use-media-upload";

function truncate(s: string, max: number): string {
  const trimmed = s.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1) + "…" : trimmed;
}

export interface ComposerProps {
  roomId: string;
  threadRootEventId?: string | null;
  onExitThread?: () => void;
}

type SendEvent = (
  roomId: string,
  threadId: string | null,
  type: string,
  content: Record<string, unknown>,
) => Promise<{ event_id: string }>;

export function Composer({ roomId, threadRootEventId, onExitThread }: ComposerProps) {
  const client = useMatrixClient();
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const { upload, progress } = useMediaUpload();

  const threadScoped = Boolean(threadRootEventId);
  const threadId = threadRootEventId ?? null;
  const quoteDraft = useQuoteDraft(roomId, threadId);
  const typingUserIds = useTyping(roomId);

  // Get the last message in the thread for the "Replying to" banner.
  // Always call the hook (avoids conditional hook rules); returns empty when rootEventId is ''.
  const threadPreview = useThreadPreview(roomId, threadRootEventId ?? "");
  const lastThreadEvent = threadPreview.events.at(-1);
  const replyingToBody = useMemo(() => {
    // Prefer the most-recent reply; fall back to the root event itself.
    if (lastThreadEvent) {
      return (lastThreadEvent.getContent() as { body?: string }).body ?? "";
    }
    if (!threadRootEventId) return "";
    const room = client?.getRoom(roomId);
    const rootEvt = room?.getLiveTimeline().getEvents().find((ev) => ev.getId() === threadRootEventId);
    return (rootEvt?.getContent() as { body?: string } | undefined)?.body ?? "";
  }, [lastThreadEvent, threadRootEventId, client, roomId]);

  async function send({ body, rawBody, mentionUserIds, attachments, setAttachments }: MessageInputSubmit): Promise<void> {
    // Slash commands only apply when there's no attachment and the body starts with /
    if (rawBody && attachments.length === 0 && !quoteDraft) {
      const slash = parseSlashCommand(rawBody, { threadScoped });
      if (slash) {
        // matrix-js-sdk auto-adds m.relates_to for m.room.message threaded
        // sends, but not for custom event types (dev.zooid.*). Set the
        // relation explicitly so the daemon can route by thread root.
        const slashContent = threadId
          ? {
              ...slash.content,
              "m.relates_to": { rel_type: "m.thread", event_id: threadId },
            }
          : slash.content;
        await (client.sendEvent as unknown as SendEvent).call(
          client,
          roomId,
          threadId,
          slash.eventType,
          slashContent,
        );
        return;
      }
    }

    // Send attachments first (before text), as per ZOD057 design. Uploads run
    // one at a time so the timeline order matches the tray order; anything
    // still unsent when one fails stays staged for a retry.
    if (attachments.length > 0) {
      const pending = [...attachments];
      try {
        while (pending.length > 0) {
          const { id, file } = pending[0];
          setUploadingId(id);
          const { contentUri } = await upload(file);
          const isImage = file.type.startsWith("image/");
          const mediaContent: Record<string, unknown> = {
            msgtype: isImage ? "m.image" : "m.file",
            body: file.name,
            url: contentUri,
            info: { mimetype: file.type, size: file.size },
          };
          if (!isImage) mediaContent.filename = file.name;
          await (client.sendEvent as unknown as SendEvent).call(
            client,
            roomId,
            threadId,
            "m.room.message",
            mediaContent,
          );
          pending.shift();
        }
      } finally {
        setUploadingId(null);
        setAttachments(pending);
      }
    }

    if (body || quoteDraft) {
      const content: Record<string, unknown> = quoteDraft
        ? buildQuoteContent({
            comment: body,
            quote: quoteDraft.quote,
            senderName: quoteDraft.senderName,
            origin: window.location.origin,
          })
        : { msgtype: "m.text", body };
      if (mentionUserIds.length > 0) {
        content["m.mentions"] = { user_ids: mentionUserIds };
      }
      await (client.sendEvent as unknown as SendEvent).call(
        client,
        roomId,
        threadId,
        "m.room.message",
        content,
      );
      if (quoteDraft) setQuoteDraft(roomId, threadId, null);
    }
  }

  async function stop(): Promise<void> {
    if (!threadId) return;
    const slash = parseSlashCommand("/stop", { threadScoped: true });
    if (!slash) return;
    setError(null);
    try {
      await (client.sendEvent as unknown as SendEvent).call(
        client,
        roomId,
        threadId,
        slash.eventType,
        { ...slash.content, "m.relates_to": { rel_type: "m.thread", event_id: threadId } },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const header = (
    <>
      {threadRootEventId && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 min-w-0">
          {replyingToBody ? (
            <>
              <span className="shrink-0">Replying to</span>
              <span className="truncate italic text-foreground/70">
                "{truncate(replyingToBody, 60)}"
              </span>
            </>
          ) : (
            <span className="shrink-0">Replying in current thread</span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {typingUserIds.length > 0 && (
              <button
                type="button"
                aria-label="Stop agent"
                onClick={() => void stop()}
                className="rounded px-2 py-1 hover:bg-muted"
              >
                Stop
              </button>
            )}
            <button
              type="button"
              aria-label="Exit thread"
              onClick={() => onExitThread?.()}
              className="rounded px-2 py-1 hover:bg-muted"
            >
              Exit thread
            </button>
          </div>
        </div>
      )}
      {quoteDraft && (
        <QuoteChip draft={quoteDraft} onRemove={() => setQuoteDraft(roomId, threadId, null)} />
      )}
    </>
  );

  return (
    <MessageInput
      roomId={roomId}
      className="shrink-0 p-3"
      suggestionsClassName="left-3 right-3"
      threadScoped={threadScoped}
      allowEmpty={Boolean(quoteDraft)}
      uploadingId={uploadingId}
      uploadProgress={progress}
      error={error}
      onError={setError}
      header={header}
      onSubmit={send}
    />
  );
}
