import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { type Room } from "matrix-js-sdk";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRoomFavorite } from "../../../hooks/use-room-favorite";
import { useUnread } from "../../../hooks/use-unread";
import { UnreadBadge } from "./unread-badge";

interface RoomRowProps {
  room: Room;
}

export function RoomRow({ room }: RoomRowProps) {
  const { isFavorite, toggle: toggleFavorite } = useRoomFavorite(room.roomId);
  const { total, highlight } = useUnread(room.roomId);
  const isUnread = total > 0;

  return (
    <div className="group/row flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent">
      <Link to={`/room/${room.roomId}`} className="flex flex-1 items-center gap-2 truncate">
        <Avatar className="size-6">
          <AvatarFallback>{(room.name ?? room.roomId).slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className={`truncate ${isUnread ? "font-semibold" : ""}`}>
          {room.name || room.roomId}
        </span>
      </Link>
      {/* Single trailing slot: badge shows by default, dropdown trigger replaces it on row hover/focus. */}
      <div className="relative h-5 min-w-5">
        <div className="group-hover/row:invisible group-focus-within/row:invisible">
          <UnreadBadge total={total} highlight={highlight} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="room actions"
              className="absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100"
            >
              <MoreHorizontal className="size-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={toggleFavorite}>
              {isFavorite ? "Remove from favorites" : "Add to favorites"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
