import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { Sidebar } from "./sidebar/sidebar";
import type { Scope } from "./sidebar/scope";

interface LeftPanelProps {
  scope: Scope;
  workforceSpaceId: string | null;
}

export function LeftPanel({ scope, workforceSpaceId }: LeftPanelProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  return <Sidebar scope={scope} workforceSpaceId={workforceSpaceId} />;
}
