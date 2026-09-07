import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface SpaceChildRowProps {
  name: string;
  topic?: string;
  memberCount: number;
  kind: "room" | "space";
  joined: boolean;
  busy?: boolean;
  onActivate: () => void;
}

export function SpaceChildRow({
  name,
  topic,
  memberCount,
  kind,
  joined,
  busy,
  onActivate,
}: SpaceChildRowProps) {
  // Rooms Join; spaces Enter — joining a space has no timeline to land in.
  const action = kind === "space" ? "Enter" : joined ? "Open" : "Join";
  return (
    <li aria-label={name} className="flex items-start gap-3 rounded-lg border border-border p-3">
      <Avatar className="size-9 shrink-0">
        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm font-medium">
          {name}
          {kind === "space" && (
            <Badge variant="outline" className="ml-2">
              Space
            </Badge>
          )}
        </p>
        {topic && <p className="line-clamp-2 text-xs text-muted-foreground">{topic}</p>}
        <p className="text-xs text-muted-foreground">
          {memberCount} member{memberCount !== 1 ? "s" : ""}
        </p>
      </div>
      <Button size="sm" variant={joined ? "ghost" : "outline"} disabled={busy} onClick={onActivate}>
        {action}
      </Button>
    </li>
  );
}
