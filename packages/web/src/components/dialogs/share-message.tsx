import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MatrixClientPeg } from "@/client/peg";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageInput, type MessageInputHandle, type MessageInputSubmit } from "@/components/rooms/message-input";
import { QuoteCardView } from "@/components/timeline/quote-card";
import { useSafeNavigate } from "@/hooks/use-safe-navigate";
import { buildQuoteContent } from "@/lib/matrix/quote";
import type { QuoteDraft } from "@/lib/quote-draft-store";
import { RoomPicker } from "./room-picker";

type SendEvent = (
  roomId: string,
  threadId: string | null,
  type: string,
  content: Record<string, unknown>,
) => Promise<{ event_id: string }>;

export interface ShareMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  draft: QuoteDraft | null;
}

export function ShareMessageDialog({ open, onOpenChange, title, draft }: ShareMessageDialogProps) {
  const navigate = useSafeNavigate();
  const client = MatrixClientPeg.safeGet();
  const [targetId, setTargetId] = useState<string | null>(null);
  const inputRef = useRef<MessageInputHandle>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rooms = useMemo(
    () =>
      (client?.getRooms() ?? [])
        .filter((r) => r.getMyMembership() === "join" && !r.isSpaceRoom())
        .sort((a, b) => a.name.localeCompare(b.name)),
    // Re-read when the dialog opens; the list is a point-in-time pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, open],
  );

  function close() {
    setTargetId(null);
    setError(null);
    onOpenChange(false);
  }

  async function send({ body, mentionUserIds }: MessageInputSubmit) {
    if (!client || !draft || !targetId) return;
    setSending(true);
    try {
      const content = buildQuoteContent({
        comment: body,
        quote: draft.quote,
        senderName: draft.senderName,
        origin: window.location.origin,
      });
      // buildQuoteContent leaves m.mentions empty; only the comment's own mentions
      // go in, so the quoted text never pings anyone.
      if (mentionUserIds.length > 0) content["m.mentions"] = { user_ids: mentionUserIds };
      await (client.sendEvent as unknown as SendEvent).call(client, targetId, null, "m.room.message", content);
      const name = client.getRoom(targetId)?.name ?? "room";
      const to = `/room/${encodeURIComponent(targetId)}`;
      toast.success(`Shared to ${name}`, { action: { label: "View", onClick: () => navigate(to) } });
      close();
    } finally {
      setSending(false);
    }
  }

  const sourceName = client?.getRoom(draft?.quote.room_id ?? "")?.name ?? "another room";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Pick a room to share this message to.</DialogDescription>
        </DialogHeader>
        <RoomPicker rooms={rooms} value={targetId} onChange={setTargetId} />
        {draft && (
          <QuoteCardView
            senderId={draft.quote.sender}
            senderName={draft.senderName}
            sourceRoomId={draft.quote.room_id}
            roomLabel={targetId && targetId !== draft.quote.room_id ? sourceName : null}
            ts={draft.quote.origin_server_ts}
            body={draft.quote.snapshot.body}
            formattedBody={draft.quote.snapshot.formatted_body}
            replyCount={draft.quote.thread?.reply_count}
          />
        )}
        <MessageInput
          ref={inputRef}
          roomId={targetId ?? ""}
          disabled={!targetId || sending}
          placeholder={targetId ? "Add a comment (optional)" : "Pick a room first"}
          ariaLabel="Comment"
          slashCommands={false}
          attachments={false}
          sendButton={false}
          allowEmpty
          error={error}
          onError={setError}
          onSubmit={send}
        />
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={!targetId || sending} onClick={() => void inputRef.current?.submit()}>
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
