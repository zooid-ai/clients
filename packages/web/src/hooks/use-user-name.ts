import { type Room, RoomStateEvent, UserEvent } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";
import { displayNameOf, nameOfMember } from "../lib/sender";

function snapshot(userId: string, roomId?: string): string {
  const client = MatrixClientPeg.safeGet();
  if (!client) return displayNameOf(userId);
  if (roomId) {
    const room = client.getRoom(roomId);
    const member = room?.getMember(userId);
    if (member) return nameOfMember(member);
  }
  const user = client.getUser(userId);
  if (user?.displayName) return user.displayName;
  return displayNameOf(userId);
}

/**
 * Resolve a user's visible name, scoped to a room when one is provided.
 * Subscribes to relevant member / profile events so the rendered name
 * updates if it changes mid-session.
 */
export function useUserName(userId: string, roomId?: string): string {
  return useSyncExternalStore(
    (cb) => {
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      const client = MatrixClientPeg.safeGet();
      if (!client) return unsubPeg;

      const room: Room | null = roomId ? client.getRoom(roomId) ?? null : null;
      const onMember = () => cb();
      room?.currentState.on(RoomStateEvent.Members, onMember);

      const user = client.getUser(userId);
      const onDisplayName = () => cb();
      user?.on(UserEvent.DisplayName, onDisplayName);

      return () => {
        room?.currentState.off(RoomStateEvent.Members, onMember);
        user?.off(UserEvent.DisplayName, onDisplayName);
        unsubPeg();
      };
    },
    () => snapshot(userId, roomId),
    () => displayNameOf(userId),
  );
}
