import { ChevronDown, Star } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useMatch } from "react-router-dom";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useRoomFavorite } from "../../hooks/use-room-favorite";
import { useUserName } from "../../hooks/use-user-name";
import { InviteUserDialog } from "../dialogs/invite-user";
import { RenameRoomDialog } from "../dialogs/rename-room";

interface RoomHeaderProps {
  spaceId: string | null;
}

export function RoomHeader({ spaceId }: RoomHeaderProps) {
  const match = useMatch("/room/:roomId");
  const roomId = match?.params.roomId;
  const client = useSyncExternalStore(
    (cb) => MatrixClientPeg.subscribe(cb),
    () => MatrixClientPeg.safeGet(),
    () => null,
  );
  const members = useMembers(roomId ?? "");
  const myPL = useMyPowerLevel(roomId ?? "");
  const { isFavorite, toggle: toggleFavorite } = useRoomFavorite(roomId ?? "");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

  if (!roomId || !client) return null;

  const room = client.getRoom(roomId);
  const roomName = room?.name ?? roomId;
  const invitePL =
    (room?.currentState.getStateEvents("m.room.power_levels", "")?.getContent() as {
      invite?: number;
    } | null)?.invite ?? 50;
  const canInvite = myPL.level >= invitePL;
  const canRename = myPL.canSendStateEvent("m.room.name");

  return (
    <>
      <Separator orientation="vertical" className="h-4" />
      {canRename ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Room actions"
              className="h-7 max-w-48 gap-1 truncate px-1.5 text-sm font-medium"
            >
              <span className="truncate">{roomName}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              Rename room
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="text-sm font-medium truncate max-w-48">{roomName}</span>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        onClick={() => void toggleFavorite()}
        className="size-6 text-muted-foreground hover:text-foreground"
      >
        <Star
          className={`size-3.5 ${isFavorite ? "fill-current text-amber-500" : ""}`}
        />
      </Button>
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
            {canInvite && spaceId && (
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
                  <MemberRow roomId={roomId} userId={m.userId} />
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
      {spaceId && (
        <InviteUserDialog
          open={inviteOpen}
          roomId={roomId}
          spaceId={spaceId}
          onOpenChange={setInviteOpen}
        />
      )}
      <RenameRoomDialog
        open={renameOpen}
        roomId={roomId}
        currentName={roomName}
        onOpenChange={setRenameOpen}
      />
    </>
  );
}

function MemberRow({ roomId, userId }: { roomId: string; userId: string }) {
  const { presence } = usePresence(userId);
  const name = useUserName(userId, roomId);
  return (
    <>
      <UserAvatar userId={userId} size="sm" presence={presence} />
      <span className="text-sm truncate">{name}</span>
    </>
  );
}
