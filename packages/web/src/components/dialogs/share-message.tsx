import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MatrixClientPeg } from "@/client/peg";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QuoteCardView } from "@/components/timeline/quote-card";
import { useSafeNavigate } from "@/hooks/use-safe-navigate";
import { buildQuoteContent } from "@/lib/matrix/quote";
import type { QuoteDraft } from "@/lib/quote-draft-store";

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
  const [query, setQuery] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
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
  const q = query.trim().toLowerCase();
  const filtered = q ? rooms.filter((r) => r.name.toLowerCase().includes(q)) : rooms;

  function close() {
    setQuery("");
    setTargetId(null);
    setComment("");
    setError(null);
    onOpenChange(false);
  }

  async function send() {
    if (!client || !draft || !targetId) return;
    setSending(true);
    setError(null);
    try {
      const content = buildQuoteContent({
        comment,
        quote: draft.quote,
        senderName: draft.senderName,
        origin: window.location.origin,
      });
      await (client.sendEvent as unknown as SendEvent).call(client, targetId, null, "m.room.message", content);
      const name = client.getRoom(targetId)?.name ?? "room";
      const to = `/room/${encodeURIComponent(targetId)}`;
      toast.success(`Shared to ${name}`, { action: { label: "View", onClick: () => navigate(to) } });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
        </DialogHeader>
        <Input
          aria-label="Search rooms"
          placeholder="Search rooms"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div role="listbox" aria-label="Rooms" className="max-h-48 overflow-y-auto rounded-md border border-border">
          {filtered.map((r) => (
            <button
              key={r.roomId}
              type="button"
              role="option"
              aria-selected={r.roomId === targetId}
              onClick={() => setTargetId(r.roomId)}
              className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              {r.name}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No rooms match</p>}
        </div>
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
        <Textarea
          aria-label="Comment"
          placeholder="Add a comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={!targetId || sending} onClick={() => void send()}>
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
