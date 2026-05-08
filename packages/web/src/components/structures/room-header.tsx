import { useState, useSyncExternalStore } from "react";
import { useMatch } from "react-router-dom";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { MatrixClientPeg } from "../../client/peg";
import { useMembers } from "../../hooks/use-members";
import { useMyPowerLevel } from "../../hooks/use-my-power-level";
import { usePresence } from "../../hooks/use-presence";
import { displayNameOf } from "../../lib/sender";
import { InviteUserDialog } from "../dialogs/invite-user";

export function RoomHeader() {
  const match = useMatch("/room/:roomId");
  const roomId = match?.params.roomId;
  const client = useSyncExternalStore(
    (cb) => MatrixClientPeg.subscribe(cb),
    () => MatrixClientPeg.safeGet(),
    () => null,
  );
  const members = useMembers(roomId ?? "");
  const myPL = useMyPowerLevel(roomId ?? "");
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!roomId || !client) return null;

  const room = client.getRoom(roomId);
  const roomName = room?.name ?? roomId;
  const invitePL =
    (room?.currentState.getStateEvents("m.room.power_levels", "")?.getContent() as {
      invite?: number;
    } | null)?.invite ?? 50;
  const canInvite = myPL.level >= invitePL;

  return (
    <>
      <Separator orientation="vertical" className="h-4" />
      <span className="text-sm font-medium truncate max-w-48">{roomName}</span>
      {members.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs text-muted-foreground"
            >
              {members.length} member{members.length !== 1 ? "s" : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            {canInvite && (
              <Button
                variant="outline"
                size="sm"
                className="mb-2 w-full"
                onClick={() => setInviteOpen(true)}
              >
                Invite
              </Button>
            )}
            <ul className="space-y-1">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 py-0.5">
                  <MemberRow userId={m.userId} />
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
      <InviteUserDialog open={inviteOpen} roomId={roomId} onOpenChange={setInviteOpen} />
    </>
  );
}

function MemberRow({ userId }: { userId: string }) {
  const { presence } = usePresence(userId);
  return (
    <>
      <UserAvatar userId={userId} size="sm" presence={presence} />
      <span className="text-sm truncate">{displayNameOf(userId)}</span>
    </>
  );
}
