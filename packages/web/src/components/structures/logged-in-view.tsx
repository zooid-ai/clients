import { useEffect } from "react";
import { Outlet } from "react-router-dom";
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
import { useSpaceName } from "../../hooks/use-space-name";
import { displayNameOf } from "../../lib/sender";
import { LeftPanel } from "./left-panel";
import { RoomHeader } from "./room-header";

export function LoggedInView() {
  const client = useMatrixClient();
  const userId = client.getUserId() ?? "";
  const serverName = userId.split(":")[1] ?? userId;
  const spaceLocalpart =
    (import.meta.env.VITE_WORKFORCE_SPACE as string | undefined) ?? "dev";
  const { spaceId } = useActiveSpaceId(spaceLocalpart, serverName);
  const spaceName = useSpaceName(spaceId);
  const headerLabel = spaceName ?? spaceLocalpart;

  useEffect(() => {
    client.startClient({ initialSyncLimit: 10 }).catch(() => {});
  }, [client]);

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-12 flex-row items-center border-b border-sidebar-border px-4">
          <span className="text-sm font-medium truncate">{headerLabel}</span>
        </SidebarHeader>
        <SidebarContent>
          <LeftPanel spaceId={spaceId} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset data-testid="logged-in-view">
        <header className="flex items-center justify-between border-b border-border px-4 h-12">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <RoomHeader spaceId={spaceId} />
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
