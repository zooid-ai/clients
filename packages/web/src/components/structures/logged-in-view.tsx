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
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { useNotifications } from "@/hooks/use-notifications";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { RoomHeader } from "./room-header";
import { RoomPanel } from "./room-panel";
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
  const [rightPanel, setRightPanel] = useState<"home" | "people" | "notifications" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useNotifications();
  const roomMatch = useMatch("/room/:roomId");
  const roomId = roomMatch?.params.roomId ?? null;

  useEffect(() => {
    client.startClient({ initialSyncLimit: 10 }).catch(() => {});
  }, [client]);

  useEffect(() => {
    if (scope) return;
    if (spaceId) setScope({ kind: "space", spaceId });
  }, [spaceId, scope]);

  const activeScope: Scope = scope ?? (spaceId ? { kind: "space", spaceId } : { kind: "home" });

  const openPanel = (view: "home" | "people" | "notifications") =>
    setRightPanel((p) => (p === view ? null : view));

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-12 flex-row items-center border-b border-sidebar-border px-2">
          <SpaceSwitcher scope={activeScope} onSelect={setScope} />
        </SidebarHeader>
        <SidebarContent>
          <LeftPanel scope={activeScope} workforceSpaceId={spaceId} />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                aria-label="User menu"
                className="h-9 w-full justify-start gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              >
                <UserAvatar userId={userId} size="sm" className="shrink-0" />
                <span className="truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
                  {myName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem disabled className="font-medium">
                {myName}
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {userId}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => MatrixClientPeg.reset()}>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset data-testid="logged-in-view">
        <header className="flex h-12 items-center gap-2 border-b border-border px-3">
          <SidebarTrigger aria-label="Toggle sidebar" />
          <div className="flex flex-1 min-w-0 items-center">
            <RoomHeader
              membersOpen={rightPanel === "people"}
              onToggleMembers={() => openPanel("people")}
              onOpenInfo={() => openPanel("home")}
              onOpenMore={() => openPanel("home")}
            />
          </div>
        </header>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        <main className="flex-1 min-h-0 overflow-hidden">
          <div className="flex h-full min-h-0">
            <div className="min-w-0 flex-1 overflow-hidden">
              <Outlet context={{ spaceId } satisfies LoggedInOutletContext} />
            </div>
            {roomId && rightPanel && (
              <RoomPanel
                roomId={roomId}
                spaceId={spaceId}
                view={rightPanel}
                onNavigate={setRightPanel}
                onClose={() => setRightPanel(null)}
              />
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
