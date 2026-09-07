import { type Room } from "matrix-js-sdk";
import { useMemo } from "react";
import { MatrixClientPeg } from "../client/peg";
import { useJoinedSpaces } from "./use-joined-spaces";
import { useSpaceChildren } from "./use-space-children";
import { type UnreadCounts, useSectionUnread } from "./use-section-unread";

export function useSpaceUnread(spaceId: string): UnreadCounts {
  const children = useSpaceChildren(spaceId);
  const rooms = useMemo(
    () => children.filter((r) => !r.isSpaceRoom() && r.getMyMembership() === "join"),
    [children],
  );
  return useSectionUnread(rooms);
}

/**
 * Unread across every joined space *except* the active one. The trigger badge
 * answers "is something happening where I'm not looking" — counting the active
 * space would just echo the room list rendered directly below it.
 *
 * Rooms are de-duplicated by id: a room that is a child of two spaces must not
 * count twice in the aggregate. (Per-space menu badges do double-count, which
 * the spec accepts — each answers a question about its own space.)
 */
export function useInactiveSpacesUnread(activeSpaceId: string | null): UnreadCounts {
  const spaces = useJoinedSpaces();
  const rooms = useMemo(() => {
    const client = MatrixClientPeg.safeGet();
    if (!client) return [] as Room[];
    const seen = new Set<string>();
    const out: Room[] = [];
    for (const space of spaces) {
      if (space.roomId === activeSpaceId) continue;
      for (const ev of space.currentState.getStateEvents("m.space.child")) {
        const id = ev.getStateKey();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const room = client.getRoom(id);
        if (room && !room.isSpaceRoom() && room.getMyMembership() === "join") out.push(room);
      }
    }
    return out;
  }, [spaces, activeSpaceId]);
  return useSectionUnread(rooms);
}
