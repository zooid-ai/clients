import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useGlobalSearchEnabled } from "../../../client/feature-flags";

/** A link row, not a fake filter: navigates to /search. Hidden when the flag is off. */
export function SidebarSearchBar() {
  if (!useGlobalSearchEnabled()) return null;

  return (
    <Link
      to="/search"
      className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      Search
    </Link>
  );
}
