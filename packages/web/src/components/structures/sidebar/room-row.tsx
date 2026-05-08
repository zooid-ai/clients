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
import { MatrixClientPeg } from "../../../client/peg";

interface RoomRowProps {
  room: Room;
}

export function RoomRow({ room }: RoomRowProps) {
  const isFavorite = Boolean(
    (room as unknown as { tags?: Record<string, unknown> }).tags?.["m.favourite"],
  );
  const client = MatrixClientPeg.safeGet();
  const toggleFavorite = async () => {
    if (!client) return;
    if (isFavorite) {
      await (
        client as unknown as { deleteRoomTag: (r: string, t: string) => Promise<void> }
      ).deleteRoomTag(room.roomId, "m.favourite");
    } else {
      await (
        client as unknown as { setRoomTag: (r: string, t: string, m: unknown) => Promise<void> }
      ).setRoomTag(room.roomId, "m.favourite", { order: 0.5 });
    }
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-sidebar-accent">
      <Link to={`/room/${room.roomId}`} className="flex flex-1 items-center gap-2 truncate">
        <Avatar className="size-6">
          <AvatarFallback>{(room.name ?? room.roomId).slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="truncate">{room.name || room.roomId}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="room actions"
            className="opacity-0 hover:opacity-100 focus:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={toggleFavorite}>
            {isFavorite ? "Remove from favorites" : "Add to favorites"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
