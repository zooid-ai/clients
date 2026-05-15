import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MatrixClientPeg } from "../../client/peg";

interface RenameRoomDialogProps {
  open: boolean;
  roomId: string;
  currentName: string;
  onOpenChange: (open: boolean) => void;
}

export function RenameRoomDialog({
  open,
  roomId,
  currentName,
  onOpenChange,
}: RenameRoomDialogProps) {
  const [value, setValue] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(currentName);
      setError(null);
      setSubmitting(false);
    }
  }, [open, currentName]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== currentName && !submitting;

  const onSave = async () => {
    const client = MatrixClientPeg.safeGet();
    if (!client) return;
    setSubmitting(true);
    setError(null);
    try {
      await (
        client as unknown as { setRoomName: (r: string, n: string) => Promise<unknown> }
      ).setRoomName(roomId, trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename room</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="room-name">Room name</Label>
          <Input
            id="room-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={256}
            autoFocus
          />
          {error && (
            <div role="alert" className="text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void onSave()} disabled={!canSubmit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
