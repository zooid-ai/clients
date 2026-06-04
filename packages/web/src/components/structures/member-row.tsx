import { Ban, DoorOpen, MoreHorizontal, X } from "lucide-react";
import { useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { MatrixClientPeg } from "../../client/peg";
import { useMemberRoles } from "../../hooks/use-member-roles";
import { useMyPowerLevel } from "../../hooks/use-my-power-level";
import { usePresence } from "../../hooks/use-presence";
import { useSetPowerLevel } from "../../hooks/use-set-power-level";
import { useUserName } from "../../hooks/use-user-name";
import { roleForLevel, roleLabel, standardRoleOptions } from "../../lib/roles";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";

export function MemberRow({
  roomId,
  userId,
  membership = "join",
}: {
  roomId: string;
  userId: string;
  membership?: "join" | "invite";
}) {
  const { presence } = usePresence(userId);
  const name = useUserName(userId, roomId);
  const roles = useMemberRoles(roomId);
  const myPL = useMyPowerLevel(roomId);
  const me = MatrixClientPeg.safeGet()?.getUserId();

  if (membership === "invite") {
    const onCancel = async () => {
      try {
        await MatrixClientPeg.safeGet()?.kick(roomId, userId);
      } catch {
        // Server rejection: the pending list reflects the unchanged state.
      }
    };
    return (
      <>
        <UserAvatar userId={userId} size="sm" presence={presence} />
        <span className="text-sm truncate flex-1">{name}</span>
        {myPL.canKick && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel invite"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => void onCancel()}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </>
    );
  }

  const entry = roles.find((r) => r.userId === userId);
  const role = entry?.role ?? roleForLevel(0);
  const isSelf = userId === me;

  const canEditRoles = myPL.canSendStateEvent("m.room.power_levels");
  // Rule 9: editable only if viewer outranks the target (peers/superiors locked).
  // Self is editable (self-demote) regardless of own level.
  const targetLevel = entry?.powerLevel ?? 0;
  const editable = canEditRoles && (isSelf ? true : targetLevel < myPL.level);
  const canModerate = !isSelf && (myPL.canKick || myPL.canBan);

  return (
    <>
      <UserAvatar userId={userId} size="sm" presence={presence} />
      <span className="text-sm truncate flex-1">{name}</span>
      <span className="text-xs text-muted-foreground">{roleLabel(role)}</span>
      {(editable || canModerate) && (
        <MemberActions
          roomId={roomId}
          userId={userId}
          currentLevel={role.level}
          viewerLevel={myPL.level}
          editable={editable}
          canKick={canModerate && myPL.canKick}
          canBan={canModerate && myPL.canBan}
          isCustomRole={role.kind === "custom"}
          customRoleLabel={roleLabel(role)}
        />
      )}
    </>
  );
}

function MemberActions({
  roomId,
  userId,
  currentLevel,
  viewerLevel,
  editable,
  canKick,
  canBan,
  isCustomRole,
  customRoleLabel,
}: {
  roomId: string;
  userId: string;
  currentLevel: number;
  viewerLevel: number;
  editable: boolean;
  canKick: boolean;
  canBan: boolean;
  isCustomRole: boolean;
  customRoleLabel: string;
}) {
  const { setLevel, resetToDefault } = useSetPowerLevel(roomId);
  const [dialog, setDialog] = useState<"kick" | "ban" | null>(null);
  const options = standardRoleOptions(viewerLevel);

  const onSelectRole = async (value: string) => {
    try {
      if (value === "0") await resetToDefault(userId);
      else await setLevel(userId, Number(value));
    } catch {
      // Server/Rule-9 rejection: state hook reflects the unchanged level.
    }
  };

  const onConfirm = async (reason: string) => {
    const client = MatrixClientPeg.safeGet();
    if (!client) return;
    try {
      if (dialog === "kick") await client.kick(roomId, userId, reason || undefined);
      else if (dialog === "ban") await client.ban(roomId, userId, reason || undefined);
    } catch {
      // Server rejection: membership list reflects the unchanged state.
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Member actions"
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {editable && (
            <>
              <DropdownMenuLabel>Role</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={String(currentLevel)} onValueChange={onSelectRole}>
                {options.map((o) => (
                  <DropdownMenuRadioItem
                    key={o.kind}
                    value={String(o.level)}
                    disabled={o.disabled}
                  >
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
                {isCustomRole && (
                  // Show the current custom level as a selected, non-standard
                  // option so we never force it onto the ladder.
                  <DropdownMenuRadioItem value={String(currentLevel)} disabled>
                    {customRoleLabel}
                  </DropdownMenuRadioItem>
                )}
              </DropdownMenuRadioGroup>
            </>
          )}
          {editable && (canKick || canBan) && <DropdownMenuSeparator />}
          {canKick && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("kick")}>
              <DoorOpen className="size-3.5" />
              Kick
            </DropdownMenuItem>
          )}
          {canBan && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("ban")}>
              <Ban className="size-3.5" />
              Ban
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ModerationDialog
        kind={dialog ?? "kick"}
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        onConfirm={onConfirm}
      />
    </>
  );
}

function ModerationDialog({
  kind,
  open,
  onOpenChange,
  onConfirm,
}: {
  kind: "kick" | "ban";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const label = kind === "kick" ? "Kick" : "Ban";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label} member</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm(reason);
              setReason("");
              onOpenChange(false);
            }}
          >
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
