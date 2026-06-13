import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { RoomEvent } from "matrix-js-sdk";
import { createAvatar } from "@dicebear/core";
import { shapes } from "@dicebear/collection";
import { Avatar } from "@/components/ui/avatar";
import { MatrixClientPeg } from "@/client/peg";
import { cn } from "@/lib/utils";

function useRoomAvatarUrl(roomId: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      if (!room) return unsubPeg;
      const onChange = () => cb();
      room.on(RoomEvent.Name, onChange);
      return () => {
        room.off(RoomEvent.Name, onChange);
        unsubPeg();
      };
    },
    () => {
      const client = MatrixClientPeg.safeGet();
      const mxc = client?.getRoom(roomId)?.getMxcAvatarUrl();
      if (!mxc) return null;
      return client?.mxcUrlToHttp(mxc, 64, 64, "crop") || null;
    },
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
  const mxcSrc = useRoomAvatarUrl(roomId);
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
