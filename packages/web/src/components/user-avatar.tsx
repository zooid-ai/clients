import { useSyncExternalStore } from "react";
import { UserEvent } from "matrix-js-sdk";
import { createAvatar } from "@dicebear/core";
import { glass } from "@dicebear/collection";
import { Avatar, AvatarBadge } from "@/components/ui/avatar";
import { MatrixClientPeg } from "@/client/peg";
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

function useUserAvatarUrl(userId: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      const user = client?.getUser(userId);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      if (!user) return unsubPeg;
      const onChange = () => cb();
      user.on(UserEvent.AvatarUrl, onChange);
      return () => {
        user.off(UserEvent.AvatarUrl, onChange);
        unsubPeg();
      };
    },
    () => {
      const client = MatrixClientPeg.safeGet();
      const user = client?.getUser(userId);
      if (!user?.avatarUrl) return null;
      return client?.mxcUrlToHttp(user.avatarUrl, 64, 64, "crop") ?? null;
    },
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
  const mxcSrc = useUserAvatarUrl(userId);
  const fallbackSrc = createAvatar(glass, { seed: avatarSeed(userId) }).toDataUri();
  const src = mxcSrc ?? fallbackSrc;
  // xs is not a data-size on Avatar — apply it via className instead
  const avatarSize = size === "xs" ? "sm" : size;
  return (
    <Avatar
      size={avatarSize}
      className={cn(size === "xs" && "!size-4", className)}
    >
      <img src={src} alt={userId} className="aspect-square size-full rounded-full object-cover" />
      {presence !== undefined && (
        <AvatarBadge
          data-presence={presence}
          className={cn(PRESENCE_COLORS[presence] ?? PRESENCE_COLORS.offline)}
        />
      )}
    </Avatar>
  );
}
