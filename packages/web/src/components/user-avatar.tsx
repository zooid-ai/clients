import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { type RoomMember, RoomStateEvent, UserEvent } from "matrix-js-sdk";
import { createAvatar } from "@dicebear/core";
import { glass } from "@dicebear/collection";
import { Avatar, AvatarBadge } from "@/components/ui/avatar";
import { MatrixClientPeg } from "@/client/peg";
import { useAuthedMediaUrl } from "@/lib/matrix/authed-media";
import { cn } from "@/lib/utils";

function avatarSeed(userId: string): string {
  const colon = userId.indexOf(":");
  if (colon > 0) {
    const localpart = userId.slice(1, colon);
    const homeserver = userId.slice(colon + 1);
    return `${homeserver}+${localpart}`;
  }
  return userId;
}

const PRESENCE_COLORS: Record<string, string> = {
  online: "bg-green-400",
  unavailable: "bg-yellow-400",
  offline: "bg-zinc-500",
};

/** The user's `mxc://` avatar, or null if they have none we know of yet. */
function useUserAvatarMxc(userId: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      const user = client?.getUser(userId);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      const onChange = () => cb();
      // UserEvent.AvatarUrl only fires for presence updates and for our own
      // profile changes. Everyone else's avatar reaches the store through
      // m.room.member events, whose User.setAvatarUrl() emits nothing — so
      // watch room state too or a member's avatar stays stale until remount.
      const onMembers = (_e: unknown, _s: unknown, member: RoomMember) => {
        if (member.userId === userId) cb();
      };
      client?.on(RoomStateEvent.Members, onMembers);
      user?.on(UserEvent.AvatarUrl, onChange);
      return () => {
        client?.off(RoomStateEvent.Members, onMembers);
        user?.off(UserEvent.AvatarUrl, onChange);
        unsubPeg();
      };
    },
    () => MatrixClientPeg.safeGet()?.getUser(userId)?.avatarUrl || null,
    () => null,
  );
}

interface UserAvatarProps {
  userId: string;
  size?: "xs" | "sm" | "default" | "lg";
  presence?: "online" | "offline" | "unavailable";
  className?: string;
}

export function UserAvatar({ userId, size = "default", presence, className }: UserAvatarProps) {
  const mxc = useUserAvatarMxc(userId);
  // Media is authenticated (Matrix 1.11+), so this is an object URL fetched
  // with the access token, not a plain thumbnail link.
  const mxcSrc = useAuthedMediaUrl(mxc, { width: 64, height: 64, method: "crop" });
  const fallbackSrc = useMemo(
    () => createAvatar(glass, { seed: avatarSeed(userId) }).toDataUri(),
    [userId],
  );
  // Degrade to the generated avatar if the thumbnail itself fails to load.
  // Reset when the source changes so a newly uploaded avatar gets a fresh attempt.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [mxcSrc]);
  // `||`, not `??`: an empty-string mxcSrc must also fall through to fallback.
  const src = !failed && mxcSrc ? mxcSrc : fallbackSrc;
  // xs is not a data-size on Avatar — apply it via className instead
  const avatarSize = size === "xs" ? "sm" : size;
  return (
    <Avatar
      size={avatarSize}
      className={cn(size === "xs" && "!size-4", className)}
    >
      <img
        src={src}
        alt={userId}
        onError={() => {
          if (!failed && mxcSrc) setFailed(true);
        }}
        className="aspect-square size-full rounded-full object-cover"
      />
      {presence !== undefined && (
        <AvatarBadge
          data-presence={presence}
          className={cn(PRESENCE_COLORS[presence] ?? PRESENCE_COLORS.offline)}
        />
      )}
    </Avatar>
  );
}
