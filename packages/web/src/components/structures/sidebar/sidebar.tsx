import { type Room } from "matrix-js-sdk";
import { useDirectRooms } from "../../../hooks/use-direct-rooms";
import { useFavoriteRooms } from "../../../hooks/use-favorite-rooms";
import { useSpaceChildren } from "../../../hooks/use-space-children";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RoomRow } from "./room-row";
import { Section } from "./section";

interface SidebarProps {
  spaceId: string;
}

export function Sidebar({ spaceId }: SidebarProps) {
  const favorites = useFavoriteRooms();
  const dms = useDirectRooms();
  const spaceChildren = useSpaceChildren(spaceId);

  // First-claim ordering: Favorites → DMs → Rooms.
  const claimed = new Set<string>();
  const claim = (rooms: Room[]) => {
    const out: Room[] = [];
    for (const r of rooms) {
      if (claimed.has(r.roomId)) continue;
      claimed.add(r.roomId);
      out.push(r);
    }
    return out;
  };
  const favList = claim(favorites);
  const dmList = claim(dms);
  const roomList = claim(spaceChildren);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-2">
        <Section title="Favorites" id="favorites">
          {favList.map((r) => (
            <RoomRow key={r.roomId} room={r} />
          ))}
        </Section>
        <Section title="DMs" id="dms">
          {dmList.map((r) => (
            <RoomRow key={r.roomId} room={r} />
          ))}
        </Section>
        <Section title="Rooms" id="rooms">
          {roomList.map((r) => (
            <RoomRow key={r.roomId} room={r} />
          ))}
        </Section>
      </div>
    </ScrollArea>
  );
}
