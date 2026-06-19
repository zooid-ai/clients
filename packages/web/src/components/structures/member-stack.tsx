import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { MatrixClientPeg } from "../../client/peg";
import type { MemberRole } from "../../hooks/use-member-roles";

const MAX_SHOWN = 3;

// Choose which avatars to surface: most-recently-active first, with a stable
// display-name tiebreak. The tiebreak keeps the order deterministic when no
// activity data is available (common on fresh/local homeservers, where
// getLastActiveTs() returns 0 for everyone).
export function pickStackMembers(
  members: MemberRole[],
  lastActiveTs: (userId: string) => number,
  max = MAX_SHOWN,
): MemberRole[] {
  return [...members]
    .sort(
      (a, b) =>
        lastActiveTs(b.userId) - lastActiveTs(a.userId) ||
        a.displayName.localeCompare(b.displayName),
    )
    .slice(0, max);
}

interface MemberStackProps {
  members: MemberRole[];
  open?: boolean;
  onToggle?: () => void;
}

// Overlapping avatar stack standing in for the old "N members" text chip.
// Shows up to three joined members (self included) plus a "+N" overflow, and
// opens the member roster on click.
export function MemberStack({ members, open, onToggle }: MemberStackProps) {
  const count = members.length;
  const lastActiveTs = (userId: string) =>
    MatrixClientPeg.safeGet()?.getUser(userId)?.getLastActiveTs() ?? 0;
  const shown = pickStackMembers(members, lastActiveTs);
  const overflow = count - shown.length;

  // Keep an accessible name of the form "N member(s)" so the count stays
  // glanceable to screen readers even though the visual is now avatars.
  const label = `${count} member${count !== 1 ? "s" : ""}`;
  const tooltip = count === 1 ? "Only you" : `${label} — click to view`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={open}
            aria-label={label}
            onClick={onToggle}
            className="h-7 px-1 hover:bg-transparent"
          >
            {/* Open state highlights the avatars themselves with a neutral
                foreground ring — white in dark mode (twMerge overrides the
                group's default ring-background) — instead of painting a box
                behind them. */}
            <AvatarGroup className={open ? "*:data-[slot=avatar]:ring-foreground" : undefined}>
              {shown.map((m) => (
                <UserAvatar key={m.userId} userId={m.userId} size="sm" />
              ))}
              {overflow > 0 && (
                <AvatarGroupCount className={open ? "ring-foreground text-foreground" : undefined}>
                  +{overflow}
                </AvatarGroupCount>
              )}
            </AvatarGroup>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
