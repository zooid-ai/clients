import { BellOff, Ellipsis, Globe, Lock, Star, Users } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useMatch } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MatrixClientPeg } from "../../client/peg";
import { MemberStack } from "./member-stack";
import { useJoinRule } from "../../hooks/use-join-rule";
import { useMemberRoles } from "../../hooks/use-member-roles";
import { useRoomFavorite } from "../../hooks/use-room-favorite";
import { useRoomNotifState } from "../../hooks/use-room-notif-state";

const JOIN_RULE_INDICATOR = {
  invite: { Icon: Lock, label: "Invite only" },
  restricted: { Icon: Users, label: "Space members" },
  public: { Icon: Globe, label: "Anyone can join" },
} as const;

interface RoomHeaderProps {
  membersOpen?: boolean;
  onToggleMembers?: () => void;
  onOpenInfo?: () => void;
  onOpenMore?: () => void;
}

export function RoomHeader({ membersOpen, onToggleMembers, onOpenInfo, onOpenMore }: RoomHeaderProps) {
  const match = useMatch("/room/:roomId");
  const roomId = match?.params.roomId;
  const client = useSyncExternalStore(
    (cb) => MatrixClientPeg.subscribe(cb),
    () => MatrixClientPeg.safeGet(),
    () => null,
  );
  const members = useMemberRoles(roomId ?? "");
  const { isFavorite, toggle: toggleFavorite } = useRoomFavorite(roomId ?? "");
  const { rule } = useJoinRule(roomId ?? "");
  const { state: notifState } = useRoomNotifState(roomId ?? "");

  if (!roomId || !client) return null;

  const room = client.getRoom(roomId);
  const roomName = room?.name ?? roomId;
  const { Icon: RuleIcon, label: ruleLabel } = JOIN_RULE_INDICATOR[rule];

  return (
    <>
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
      <Button
        variant="ghost"
        size="sm"
        className="h-7 max-w-48 truncate px-1.5 text-sm font-medium"
        onClick={onOpenInfo}
      >
        <span className="truncate">{roomName}</span>
      </Button>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-label={ruleLabel}
              className="flex size-5 items-center justify-center text-muted-foreground"
            >
              <RuleIcon className="size-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{ruleLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {notifState === "mute" && (
        <span
          aria-label="Muted"
          className="flex size-5 items-center justify-center text-muted-foreground"
        >
          <BellOff className="size-3.5" />
        </span>
      )}
      <div className="flex-1" />
      {members.length > 0 && (
        <MemberStack members={members} open={membersOpen} onToggle={onToggleMembers} />
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label="More room options"
        className="size-6 text-muted-foreground"
        onClick={onOpenMore}
      >
        <Ellipsis className="size-3.5" />
      </Button>
    </>
  );
}
