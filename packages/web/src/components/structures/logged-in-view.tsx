import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { MatrixClientPeg } from "../../client/peg";
import { useMatrixClient } from "../../hooks/use-matrix-client";
import { LeftPanel } from "./left-panel";
import { MainSplit } from "./main-split";

export function LoggedInView() {
  const client = useMatrixClient();
  const userId = client.getUserId() ?? "";

  useEffect(() => {
    client.startClient({ initialSyncLimit: 10 }).catch(() => {
      // sync errors are out of scope for this cycle; surface in future epic
    });
  }, [client]);

  return (
    <div data-testid="logged-in-view" className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 h-12">
        <span className="text-sm">{userId}</span>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="User menu">
                <Avatar>
                  <AvatarFallback>{userId.slice(1, 3).toUpperCase()}</AvatarFallback>
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
      <div className="flex-1 min-h-0">
        <MainSplit left={<LeftPanel />} main={<Outlet />} />
      </div>
    </div>
  );
}
