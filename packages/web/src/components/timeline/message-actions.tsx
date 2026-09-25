import { useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { Copy, Forward, Link2, MoreHorizontal, Pencil, Quote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BAR_BUTTON =
  "inline-flex items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground";

export function ShareButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={BAR_BUTTON}>
      <Forward className="size-4" />
    </button>
  );
}

interface MessageMoreMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopyLink: () => void;
  onCopyText: () => void;
  onQuote: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MessageMoreMenu(p: MessageMoreMenuProps) {
  return (
    // modal={false}: a modal menu leaves pointer-events:none on <body> when
    // an item opens a Dialog (Delete), which freezes the page.
    <DropdownMenu open={p.open} onOpenChange={p.onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="More actions" className={BAR_BUTTON}>
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={p.onCopyLink}>
          <Link2 />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={p.onCopyText}>
          <Copy />
          Copy text
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={p.onQuote}>
          <Quote />
          Quote
        </DropdownMenuItem>
        {(p.onEdit || p.onDelete) && <DropdownMenuSeparator />}
        {p.onEdit && (
          <DropdownMenuItem onSelect={p.onEdit}>
            <Pencil />
            Edit
          </DropdownMenuItem>
        )}
        {p.onDelete && (
          <DropdownMenuItem variant="destructive" onSelect={p.onDelete}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({ open, onOpenChange, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete message?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This action cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface InlineEditProps {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function InlineEdit({ initialValue, onSave, onCancel }: InlineEditProps) {
  const [value, setValue] = useState(initialValue);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && value !== initialValue) {
        onSave(value.trim());
      } else {
        onCancel();
      }
    }
    if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <textarea
      aria-label="Edit message"
      className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      autoFocus
      rows={3}
    />
  );
}

type SendEvent = (
  roomId: string,
  threadId: string | null,
  type: string,
  content: Record<string, unknown>,
) => Promise<{ event_id: string }>;

export async function sendEditEvent(
  client: MatrixClient,
  roomId: string,
  eventId: string,
  body: string,
) {
  await (client.sendEvent as unknown as SendEvent).call(client, roomId, null, "m.room.message", {
    msgtype: "m.text",
    body: `* ${body}`,
    "m.new_content": { msgtype: "m.text", body },
    "m.relates_to": { rel_type: "m.replace", event_id: eventId },
  });
}
