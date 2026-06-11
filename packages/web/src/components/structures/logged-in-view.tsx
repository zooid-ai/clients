import { useEffect, useState } from "react";
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
import { ProfileSettingsDialog } from "@/components/settings/profile-settings-dialog";
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
import { useUserName } from "../../hooks/use-user-name";
import { LeftPanel } from "./left-panel";
import { MemberPanel } from "./member-panel";
import { RoomHeader } from "./room-header";
import type { Scope } from "./sidebar/scope";
import { SpaceSwitcher } from "./sidebar/space-switcher";

export interface LoggedInOutletContext {
  spaceId: string | null;
}

export function LoggedInView() {
  const client = useMatrixClient();
  const userId = client.getUserId() ?? "";
  const myName = useUserName(userId);
  const serverName = userId.split(":")[1] ?? userId;
  const spaceLocalpart =
    (import.meta.env.VITE_WORKFORCE_SPACE as string | undefined) ?? "dev";
  const { spaceId } = useActiveSpaceId(spaceLocalpart, serverName);
  const [scope, setScope] = useState<Scope | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const roomMatch = useMatch("/room/:roomId");
  const roomId = roomMatch?.params.roomId ?? null;

  useEffect(() => {
    client.startClient({ initialSyncLimit: 10 }).catch(() => {});
  }, [client]);

  useEffect(() => {
    if (scope) return; // user has chosen; don't override
    if (spaceId) setScope({ kind: "space", spaceId });
  }, [spaceId, scope]);

  const activeScope: Scope = scope ?? (spaceId ? { kind: "space", spaceId } : { kind: "home" });

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-12 flex-row items-center border-b border-sidebar-border px-2">
          <SpaceSwitcher scope={activeScope} onSelect={setScope} />
        </SidebarHeader>
        <SidebarContent>
          <LeftPanel scope={activeScope} workforceSpaceId={spaceId} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset data-testid="logged-in-view">
        <header className="flex items-center justify-between border-b border-border px-4 h-12">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <RoomHeader
              membersOpen={membersOpen}
              onToggleMembers={() => setMembersOpen((v) => !v)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="User menu" className="shrink-0">
                <UserAvatar userId={userId} size="sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled className="font-medium">
                {myName}
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {userId}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => MatrixClientPeg.reset()}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <ProfileSettingsDialog open={profileOpen} onOpenChange={setProfileOpen} />
        <main className="flex-1 min-h-0 overflow-hidden">
          <div className="flex h-full min-h-0">
            <div className="min-w-0 flex-1 overflow-hidden">
              <Outlet context={{ spaceId } satisfies LoggedInOutletContext} />
            </div>
            {membersOpen && roomId && <MemberPanel roomId={roomId} spaceId={spaceId} />}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
