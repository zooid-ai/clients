import { ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useJoinedSpaces } from "../../../hooks/use-joined-spaces";
import type { Scope } from "./scope";

interface SpaceSwitcherProps {
  scope: Scope;
  onSelect: (scope: Scope) => void;
}

export function SpaceSwitcher({ scope, onSelect }: SpaceSwitcherProps) {
  const spaces = useJoinedSpaces();
  const active =
    scope.kind === "space" ? spaces.find((s) => s.roomId === scope.spaceId) : undefined;
  const label = scope.kind === "home" ? "Home" : (active?.name ?? "Space");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="switch space"
        className="flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-sm font-medium hover:bg-sidebar-accent"
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onSelect={() => onSelect({ kind: "home" })}>Home</DropdownMenuItem>
        {spaces.length > 0 ? <DropdownMenuSeparator /> : null}
        {spaces.map((s) => (
          <DropdownMenuItem
            key={s.roomId}
            onSelect={() => onSelect({ kind: "space", spaceId: s.roomId })}
          >
            {s.name ?? s.roomId}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
