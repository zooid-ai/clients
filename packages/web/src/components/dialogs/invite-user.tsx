import { type FormEvent, useState } from "react";
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

interface InviteUserDialogProps {
  open: boolean;
  roomId: string;
  onOpenChange: (open: boolean) => void;
}

const MXID_RE = /^@[^:]+:[^:]+/;

export function InviteUserDialog({ open, roomId, onOpenChange }: InviteUserDialogProps) {
  const [mxid, setMxid] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const valid = MXID_RE.test(mxid.trim());

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const client = MatrixClientPeg.safeGet();
    if (!client || !valid) return;
    setSubmitting(true);
    try {
      await (
        client as unknown as { invite: (r: string, u: string) => Promise<unknown> }
      ).invite(roomId, mxid.trim());
      onOpenChange(false);
      setMxid("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Invite to room</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-2">
            <Label htmlFor="invite-mxid">Matrix ID</Label>
            <Input
              id="invite-mxid"
              value={mxid}
              onChange={(e) => setMxid(e.target.value)}
              placeholder="@alice:example.com"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Paste the user's Matrix ID. Inviting an agent is silently no-op — agent membership
              comes from <code>daemon.yaml</code>.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || submitting}>
              Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
