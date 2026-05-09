import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useSpaceMembers } from "../../hooks/use-space-members";
import { useWorkforce } from "../../hooks/use-workforce";

interface CreateDmDialogProps {
  open: boolean;
  spaceId: string;
  onOpenChange: (open: boolean) => void;
}

export function CreateDmDialog({ open, spaceId, onOpenChange }: CreateDmDialogProps) {
  const members = useSpaceMembers(spaceId);
  const { ready, isAgent } = useWorkforce(spaceId);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const me = MatrixClientPeg.safeGet()?.getUserId();
  const candidates = useMemo(() => {
    return members
      .filter((m) => m.userId !== me)
      .filter((m) => !ready || !isAgent(m.userId));
  }, [members, me, ready, isAgent]);

  const toggle = (userId: string) => {
    setSelected((cur) => (cur.includes(userId) ? cur.filter((u) => u !== userId) : [...cur, userId]));
  };

  const onCreate = async () => {
    if (!selected.length) return;
    const client = MatrixClientPeg.safeGet();
    if (!client) return;
    setSubmitting(true);
    try {
      const created = (await (
        client as unknown as {
          createRoom: (opts: Record<string, unknown>) => Promise<{ room_id: string }>;
        }
      ).createRoom({
        is_direct: true,
        preset: "trusted_private_chat",
        invite: selected,
      })) as { room_id: string };

      const existing =
        ((
          client as unknown as {
            getAccountData: (t: string) => { getContent: () => Record<string, string[]> } | null;
          }
        ).getAccountData("m.direct")?.getContent() ?? {}) as Record<string, string[]>;
      const next = { ...existing };
      const key = selected[0]!;
      next[key] = [...(existing[key] ?? []), created.room_id];
      await (
        client as unknown as {
          setAccountData: (t: string, c: Record<string, unknown>) => Promise<unknown>;
        }
      ).setAccountData("m.direct", next);

      onOpenChange(false);
      setSelected([]);
      navigate(`/room/${created.room_id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a DM</DialogTitle>
          <DialogDescription>
            DMs are private to the people you invite. Agents are managed via <code>zooid.yaml</code>.
          </DialogDescription>
        </DialogHeader>
        {!ready && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Agent list unavailable — the picker may include agents until the workforce roster
            publishes.
          </p>
        )}
        <Command>
          <CommandInput placeholder="Search humans…" />
          <CommandList>
            <CommandEmpty>No humans found.</CommandEmpty>
            <CommandGroup>
              {candidates.map((m) => (
                <CommandItem
                  key={m.userId}
                  value={`${m.name ?? m.userId} ${m.userId}`}
                  onSelect={() => toggle(m.userId)}
                  data-selected={selected.includes(m.userId) || undefined}
                >
                  <span className="flex-1 truncate">{m.name ?? m.userId}</span>
                  <span className="text-xs text-muted-foreground">{m.userId}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!selected.length || submitting} onClick={onCreate}>
            Start DM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
