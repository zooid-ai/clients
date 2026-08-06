import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { RoomEvent, RoomStateEvent } from "matrix-js-sdk";
import { createAvatar } from "@dicebear/core";
import { shapes } from "@dicebear/collection";
import { Avatar } from "@/components/ui/avatar";
import { MatrixClientPeg } from "@/client/peg";
import { useAuthedMediaUrl } from "@/lib/matrix/authed-media";
import { cn } from "@/lib/utils";

/** The room's `mxc://` avatar, or null if it has none. */
function useRoomAvatarMxc(roomId: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      if (!room) return unsubPeg;
      const onChange = () => cb();
      room.on(RoomEvent.Name, onChange);
      // m.room.avatar lands as a state event, not a name change.
      room.currentState.on(RoomStateEvent.Events, onChange);
      return () => {
        room.off(RoomEvent.Name, onChange);
        room.currentState.off(RoomStateEvent.Events, onChange);
        unsubPeg();
      };
    },
    () => MatrixClientPeg.safeGet()?.getRoom(roomId)?.getMxcAvatarUrl() || null,
    () => null,
  );
}

export function RoomAvatar({
  roomId,
  name,
  size = "default",
  className,
}: {
  roomId: string;
  name: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const mxc = useRoomAvatarMxc(roomId);
  const mxcSrc = useAuthedMediaUrl(mxc, { width: 64, height: 64, method: "crop" });
  const fallbackSrc = useMemo(
    () => createAvatar(shapes, { seed: roomId }).toDataUri(),
    [roomId],
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [mxcSrc]);
  const src = !failed && mxcSrc ? mxcSrc : fallbackSrc;
  return (
    <Avatar size={size} className={cn("rounded-md", className)}>
      <img
        src={src}
        alt={name}
        onError={() => {
          if (!failed && mxcSrc) setFailed(true);
        }}
        className="aspect-square size-full rounded-md object-cover"
      />
    </Avatar>
  );
}
