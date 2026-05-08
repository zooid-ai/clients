import { useEffect } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { MatrixClientPeg } from "../../client/peg";
import { useActiveSpaceId } from "../../hooks/use-active-space-id";
import { useMatrixClient } from "../../hooks/use-matrix-client";
import { useMembers } from "../../hooks/use-members";
import { usePresence } from "../../hooks/use-presence";
import { displayNameOf } from "../../lib/sender";
import { LeftPanel } from "./left-panel";

function RoomHeader() {
  const match = useMatch("/room/:roomId");
  const roomId = match?.params.roomId;
  const client = useMatrixClient();
  const members = useMembers(roomId ?? "");

  if (!roomId) return null;

  const room = client.getRoom(roomId);
  const roomName = room?.name ?? roomId;

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

export function LoggedInView() {
  const client = useMatrixClient();
  const userId = client.getUserId() ?? "";
  const serverName = userId.split(":")[1] ?? userId;
  const spaceLocalpart =
    (import.meta.env.VITE_WORKFORCE_SPACE as string | undefined) ?? "dev";
  const { spaceId } = useActiveSpaceId(spaceLocalpart, serverName);

  useEffect(() => {
    client.startClient({ initialSyncLimit: 10 }).catch(() => {});
  }, [client]);

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-12 flex-row items-center border-b border-sidebar-border px-4">
          <span className="text-sm font-medium truncate">{serverName}</span>
        </SidebarHeader>
        <SidebarContent>
          <LeftPanel spaceId={spaceId} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset data-testid="logged-in-view">
        <header className="flex items-center justify-between border-b border-border px-4 h-12">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <RoomHeader />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="User menu" className="shrink-0">
                <UserAvatar userId={userId} size="sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled className="font-medium">
                {displayNameOf(userId)}
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {userId}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => MatrixClientPeg.reset()}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
