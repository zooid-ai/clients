import { Link } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRoomList } from "../../hooks/use-room-list";

export function LeftPanel() {
  const rooms = useRoomList();
  return (
    <nav aria-label="Rooms" className="h-full">
      <ScrollArea className="h-full">
        <ul className="flex flex-col gap-0.5 p-2">
          {rooms.map((room) => (
            <li key={room.roomId}>
              <Link
                to={`/room/${room.roomId}`}
                className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <Avatar className="size-6">
                  <AvatarFallback>
                    {(room.name ?? room.roomId).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{room.name || room.roomId}</span>
              </Link>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </nav>
  );
}
