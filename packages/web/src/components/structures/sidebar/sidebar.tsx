import { Flag, Plus } from "lucide-react";
import { type Room } from "matrix-js-sdk";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDirectRooms } from "../../../hooks/use-direct-rooms";
import { useFavoriteRooms } from "../../../hooks/use-favorite-rooms";
import { useMyPowerLevel } from "../../../hooks/use-my-power-level";
import { useRoomList } from "../../../hooks/use-room-list";
import { useSectionUnread } from "../../../hooks/use-section-unread";
import { useSpaceChildren } from "../../../hooks/use-space-children";
import { CreateDmDialog } from "../../dialogs/create-dm";
import { CreateRoomDialog } from "../../dialogs/create-room";
import { InvitesSection } from "./invites-section";
import { RoomRow } from "./room-row";
import type { Scope } from "./scope";
import { Section } from "./section";
import { SidebarSearchBar } from "./sidebar-search-bar";
import { UnreadBadge } from "./unread-badge";

const ICON_BTN_CLS =
  "inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground";

interface SidebarProps {
  scope: Scope;
  workforceSpaceId: string | null;
}

/** A subspace's own joined room children, one collapsible Section, depth bounded at one level. */
function SubspaceSection({ room }: { room: Room }) {
  const children = useSpaceChildren(room.roomId).filter((r) => !r.isSpaceRoom());
  const unread = useSectionUnread(children);
  return (
    <Section
      title={room.name || room.roomId}
      storageKey={`section:${room.roomId}`}
      action={<UnreadBadge total={unread.total} highlight={unread.highlight} />}
    >
      {children.map((r) => (
        <RoomRow key={r.roomId} room={r} />
      ))}
    </Section>
  );
}

export function Sidebar({ scope, workforceSpaceId }: SidebarProps) {
  const spaceId = scope.kind === "space" ? scope.spaceId : "";
  const { pathname } = useLocation();
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
  const subspaces = spaceChildren.filter((r) => r.isSpaceRoom());
  // This is the bug fix — the space branch used to pass subspaces through as room rows.
  const roomSource =
    scope.kind === "space"
      ? spaceChildren.filter((r) => !r.isSpaceRoom())
      : allRooms.filter((r) => !r.isSpaceRoom());
  const favList = claim(favorites);
  const dmList = claim(dms);
  const roomList = claim(roomSource);

  const favUnread = useSectionUnread(favList);
  const dmUnread = useSectionUnread(dmList);
  const roomUnread = useSectionUnread(roomList);

  return (
    // Plain scroll container, not Radix ScrollArea: its viewport wraps content in a
    // display:table div that grows to content width, defeating min-w-0/truncate on long
    // room names. SidebarContent already supplies the outer overflow.
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-2 p-2">
        {scope.kind === "space" ? (
          <Link
            to="/"
            className={`flex h-8 items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-sidebar-accent ${
              pathname === "/" ? "bg-sidebar-accent text-foreground" : "text-muted-foreground"
            }`}
          >
            <Flag className="size-4 shrink-0" aria-hidden />
            Lobby
          </Link>
        ) : null}
        <SidebarSearchBar />
        <InvitesSection />
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
            <TooltipProvider>
            <div className="flex items-center gap-1">
              <UnreadBadge total={roomUnread.total} highlight={roomUnread.highlight} />
              {canCreateRoom ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="add room"
                      onClick={() => setCreateRoomOpen(true)}
                      className={ICON_BTN_CLS}
                    >
                      <Plus className="size-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Create room</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            </TooltipProvider>
          }
        >
          {roomList.map((r) => (
            <RoomRow key={r.roomId} room={r} />
          ))}
        </Section>
        {subspaces.map((r) => (
          <SubspaceSection key={r.roomId} room={r} />
        ))}
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
    </div>
  );
}
