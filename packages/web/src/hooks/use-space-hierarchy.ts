import { useCallback, useEffect, useState } from "react";
import { MatrixClientPeg } from "../client/peg";
import { clientExt } from "../client/client-ext";

export interface SpaceChild {
  roomId: string;
  name?: string;
  topic?: string;
  avatarUrl?: string;
  memberCount: number;
  kind: "room" | "space";
  joined: boolean;
}

/**
 * Every child the space hierarchy reports — rooms and subspaces, joined and not.
 *
 * Membership comes from `getMyMembership()`, never from the existence of a Room:
 * `getRoom()` is truthy for `leave` and `invite` too, which is why the previous
 * `useJoinableRooms` hid rooms you had left and left them unrejoinable.
 *
 * Child order is preserved. For a workforce space it is authored in zooid.yaml,
 * so it carries intent — joined state is displayed, never sorted on.
 */
export function useSpaceHierarchy(spaceId: string, enabled: boolean) {
  const [children, setChildren] = useState<SpaceChild[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const client = MatrixClientPeg.safeGet();
    if (!client || !spaceId) return;
    setLoading(true);
    try {
      const res = (await clientExt(client).getRoomHierarchy(spaceId)) ?? { rooms: [] };
      setChildren(
        res.rooms
          .filter((r) => r.room_id !== spaceId)
          .map((r) => ({
            roomId: r.room_id,
            name: r.name,
            topic: r.topic,
            avatarUrl: r.avatar_url,
            memberCount: r.num_joined_members ?? 0,
            kind: r.room_type === "m.space" ? ("space" as const) : ("room" as const),
            joined: client.getRoom(r.room_id)?.getMyMembership() === "join",
          })),
      );
    } catch (err) {
      console.warn("[use-space-hierarchy] failed to fetch hierarchy", err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { children, loading, refresh };
}
