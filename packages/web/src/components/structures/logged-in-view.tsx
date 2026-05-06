import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { MatrixClientPeg } from "../../client/peg";
import { useMatrixClient } from "../../hooks/use-matrix-client";
import { LeftPanel } from "./left-panel";

export function LoggedInView() {
  const client = useMatrixClient();
  const userId = client.getUserId() ?? "";

  useEffect(() => {
    client.startClient({ initialSyncLimit: 10 }).catch(() => {
      // sync errors are out of scope for this cycle; surface in future epic
    });
  }, [client]);

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <span className="px-2 text-xs uppercase tracking-wider text-sidebar-foreground/70">
            Rooms
          </span>
        </SidebarHeader>
        <SidebarContent>
          <LeftPanel />
        </SidebarContent>
      </Sidebar>
      <SidebarInset data-testid="logged-in-view">
        <header className="flex items-center justify-between border-b border-border px-4 h-12">
          <div className="flex items-center gap-2">
            <SidebarTrigger aria-label="Toggle sidebar" />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm">{userId}</span>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="User menu">
                  <Avatar>
                    <AvatarFallback>
                      {userId.slice(1, 3).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>{userId}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => MatrixClientPeg.reset()}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
