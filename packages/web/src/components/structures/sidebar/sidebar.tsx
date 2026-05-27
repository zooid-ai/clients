import { Plus } from "lucide-react";
import { type Room } from "matrix-js-sdk";
import { useState } from "react";
import { useDirectRooms } from "../../../hooks/use-direct-rooms";
import { useFavoriteRooms } from "../../../hooks/use-favorite-rooms";
import { useMyPowerLevel } from "../../../hooks/use-my-power-level";
import { useRoomList } from "../../../hooks/use-room-list";
import { useSectionUnread } from "../../../hooks/use-section-unread";
import { useSpaceChildren } from "../../../hooks/use-space-children";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateDmDialog } from "../../dialogs/create-dm";
import { CreateRoomDialog } from "../../dialogs/create-room";
import { RoomRow } from "./room-row";
import type { Scope } from "./scope";
import { Section } from "./section";
import { UnreadBadge } from "./unread-badge";

const ICON_BTN_CLS =
  "inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground";

interface SidebarProps {
  scope: Scope;
  workforceSpaceId: string | null;
}

export function Sidebar({ scope, workforceSpaceId }: SidebarProps) {
  const spaceId = scope.kind === "space" ? scope.spaceId : "";
  const favorites = useFavoriteRooms();
  const dms = useDirectRooms();
  const spaceChildren = useSpaceChildren(spaceId);
  const allRooms = useRoomList();
  const myPL = useMyPowerLevel(spaceId);
  const canCreateRoom = scope.kind === "space" && myPL.canSendStateEvent("m.space.child");
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [createDmOpen, setCreateDmOpen] = useState(false);

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
  const roomSource =
    scope.kind === "space" ? spaceChildren : allRooms.filter((r) => !r.isSpaceRoom());
  const favList = claim(favorites);
  const dmList = claim(dms);
  const roomList = claim(roomSource);

  const favUnread = useSectionUnread(favList);
  const dmUnread = useSectionUnread(dmList);
  const roomUnread = useSectionUnread(roomList);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-2">
        <Section
          title="Favorites"
          action={<UnreadBadge total={favUnread.total} highlight={favUnread.highlight} />}
        >
          {favList.map((r) => (
            <RoomRow key={r.roomId} room={r} />
          ))}
        </Section>
        <Section
          title="Rooms"
          action={
            <div className="flex items-center gap-1">
              <UnreadBadge total={roomUnread.total} highlight={roomUnread.highlight} />
              {canCreateRoom ? (
                <button
                  type="button"
                  aria-label="add channel"
                  onClick={() => setCreateRoomOpen(true)}
                  className={ICON_BTN_CLS}
                >
                  <Plus className="size-3" />
                </button>
              ) : null}
            </div>
          }
        >
          {roomList.map((r) => (
            <RoomRow key={r.roomId} room={r} />
          ))}
        </Section>
        <Section
          title="DMs"
          defaultExpanded={false}
          action={
            <div className="flex items-center gap-1">
              <UnreadBadge total={dmUnread.total} highlight={dmUnread.highlight} />
              <button
                type="button"
                aria-label="start dm"
                onClick={() => setCreateDmOpen(true)}
                className={ICON_BTN_CLS}
              >
                <Plus className="size-3" />
              </button>
            </div>
          }
        >
          {dmList.map((r) => (
            <RoomRow key={r.roomId} room={r} />
          ))}
        </Section>
      </div>
      {scope.kind === "space" ? (
        <CreateRoomDialog
          open={createRoomOpen}
          spaceId={scope.spaceId}
          onOpenChange={setCreateRoomOpen}
        />
      ) : null}
      {workforceSpaceId ? (
        <CreateDmDialog
          open={createDmOpen}
          spaceId={workforceSpaceId}
          onOpenChange={setCreateDmOpen}
        />
      ) : null}
    </ScrollArea>
  );
}
