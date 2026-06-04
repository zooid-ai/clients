import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MatrixClientPeg } from "../../client/peg";
import { useUserSearch } from "../../hooks/use-user-search";
import { useWorkforce } from "../../hooks/use-workforce";

/** Pull a human-readable message out of a matrix-js-sdk error. */
function inviteErrorMessage(err: unknown): string {
  const e = err as {
    data?: { error?: string; errcode?: string };
    errcode?: string;
    message?: string;
  };
  // The server's own message is the most useful — e.g. "@bob:hs is banned from
  // the room" for a banned user. Fall back to the JS error, then a generic line.
  return (
    e.data?.error ??
    e.message ??
    "Couldn't send the invite. Please try again."
  );
}

interface InviteUserDialogProps {
  open: boolean;
  roomId: string;
  spaceId: string;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({
  open,
  roomId,
  spaceId,
  onOpenChange,
}: InviteUserDialogProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ready, isAgent } = useWorkforce(spaceId);
  const { results } = useUserSearch(query);

  const candidates = useMemo(
    () => (ready ? results.filter((r) => !isAgent(r.userId)) : results),
    [results, ready, isAgent],
  );

  const reset = () => {
    setQuery("");
    setSelected(null);
    setSubmitting(false);
    setError(null);
  };

  const onInvite = async () => {
    if (!selected) return;
    const client = MatrixClientPeg.safeGet();
    if (!client) return;
    setSubmitting(true);
    setError(null);
    try {
      await (
        client as unknown as { invite: (r: string, u: string) => Promise<unknown> }
      ).invite(roomId, selected);
      onOpenChange(false);
      reset();
    } catch (err) {
      // The invite can be rejected by the server — most commonly when the
      // target was banned (M_FORBIDDEN, "…is banned from the room"), but also
      // for insufficient power level or a stale membership. Without surfacing
      // this the dialog silently sits open and the action looks like a no-op.
      setError(inviteErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to room</DialogTitle>
          <DialogDescription>
            Agent room membership is managed via <code>zooid.yaml</code>.
          </DialogDescription>
        </DialogHeader>
        {!ready && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Agent list unavailable — search may include agents until the workforce
            roster publishes.
          </p>
        )}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search users…"
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
          <CommandList>
            <CommandEmpty>
              {query.trim() ? "No users found." : "Type to search."}
            </CommandEmpty>
            <CommandGroup>
              {candidates.map((r) => (
                <CommandItem
                  key={r.userId}
                  value={`${r.displayName ?? r.userId} ${r.userId}`}
                  onSelect={() => {
                    setSelected(r.userId);
                    setError(null);
                  }}
                  data-selected={selected === r.userId || undefined}
                >
                  <span className="flex-1 truncate">
                    {r.displayName ?? r.userId}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.userId}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onInvite} disabled={!selected || submitting}>
            Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
