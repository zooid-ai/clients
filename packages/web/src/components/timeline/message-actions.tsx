import { useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditButtonProps {
  onClick: () => void;
}

export function EditButton({ onClick }: EditButtonProps) {
  return (
    <button
      type="button"
      aria-label="Edit message"
      onClick={onClick}
      className="inline-flex items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Pencil className="size-4" />
    </button>
  );
}

interface DeleteButtonProps {
  onClick: () => void;
}

export function DeleteButton({ onClick }: DeleteButtonProps) {
  return (
    <button
      type="button"
      aria-label="Delete message"
      onClick={onClick}
      className="inline-flex items-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
    >
      <Trash2 className="size-4" />
    </button>
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
