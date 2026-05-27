import { Sidebar } from "./sidebar/sidebar";
import type { Scope } from "./sidebar/scope";

interface LeftPanelProps {
  scope: Scope;
  workforceSpaceId: string | null;
}

export function LeftPanel({ scope, workforceSpaceId }: LeftPanelProps) {
  return <Sidebar scope={scope} workforceSpaceId={workforceSpaceId} />;
}
