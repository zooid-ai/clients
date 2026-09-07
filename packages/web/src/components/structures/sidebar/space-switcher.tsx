import { ChevronsUpDown } from "lucide-react";
import { type Room } from "matrix-js-sdk";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useJoinedSpaces } from "../../../hooks/use-joined-spaces";
import { useInactiveSpacesUnread, useSpaceUnread } from "../../../hooks/use-space-unread";
import type { Scope } from "./scope";
import { UnreadBadge } from "./unread-badge";

interface SpaceSwitcherProps {
  scope: Scope;
  onSelect: (scope: Scope) => void;
}

function SpaceMenuItem({
  space,
  onSelect,
}: {
  space: Room;
  onSelect: () => void;
}) {
  const unread = useSpaceUnread(space.roomId);
  return (
    <DropdownMenuItem onSelect={onSelect} className="justify-between gap-2">
      <span className="truncate">{space.name ?? space.roomId}</span>
      <UnreadBadge total={unread.total} highlight={unread.highlight} />
    </DropdownMenuItem>
  );
}

export function SpaceSwitcher({ scope, onSelect }: SpaceSwitcherProps) {
  const spaces = useJoinedSpaces();
  const activeSpaceId = scope.kind === "space" ? scope.spaceId : null;
  const active = activeSpaceId ? spaces.find((s) => s.roomId === activeSpaceId) : undefined;
  const label = scope.kind === "home" ? "Home" : (active?.name ?? "Space");
  const inactiveUnread = useInactiveSpacesUnread(activeSpaceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="switch space"
        className="flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-sm font-medium hover:bg-sidebar-accent"
      >
        <span className="truncate">{label}</span>
        <div className="flex shrink-0 items-center gap-1">
          <UnreadBadge total={inactiveUnread.total} highlight={inactiveUnread.highlight} />
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onSelect={() => onSelect({ kind: "home" })}>Home</DropdownMenuItem>
        {spaces.length > 0 ? <DropdownMenuSeparator /> : null}
        {spaces.map((s) => (
          <SpaceMenuItem key={s.roomId} space={s} onSelect={() => onSelect({ kind: "space", spaceId: s.roomId })} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
