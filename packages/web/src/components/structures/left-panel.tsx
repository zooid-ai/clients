import { Sidebar } from "./sidebar/sidebar";

interface LeftPanelProps {
  spaceId: string | null;
}

export function LeftPanel({ spaceId }: LeftPanelProps) {
  if (!spaceId) {
    return (
      <nav aria-label="Rooms" className="h-full p-4 text-xs text-muted-foreground">
        Workforce unavailable.
      </nav>
    );
  }
  return <Sidebar spaceId={spaceId} />;
}
