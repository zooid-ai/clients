import { UserEvent } from "matrix-js-sdk";
import type { MatrixEvent, User } from "matrix-js-sdk";
import { useEffect, useState } from "react";
import { MatrixClientPeg } from "../client/peg";

export interface PresenceState {
  presence: "online" | "offline" | "unavailable";
  statusMsg: string | null;
}

const OFFLINE: PresenceState = { presence: "offline", statusMsg: null };

function readPresence(userId: string): PresenceState {
  const user = MatrixClientPeg.safeGet()?.getUser(userId);
  if (!user) return OFFLINE;
  return {
    presence: (user.presence as PresenceState["presence"]) ?? "offline",
    statusMsg: user.presenceStatusMsg ?? null,
  };
}

export function usePresence(userId: string): PresenceState {
  const [state, setState] = useState<PresenceState>(() => readPresence(userId));

  useEffect(() => {
    const client = MatrixClientPeg.safeGet();
    if (!client) return;

    const update = () => setState(readPresence(userId));

    // Subscribe directly on the User object if it already exists.
    const user = client.getUser(userId);
    if (user) {
      user.on(UserEvent.Presence, update);
    }

    // Also listen at the client level: the SDK re-emits UserEvent.Presence for
    // all users (including ones whose User object didn't exist on mount).
    const clientUpdate = (_event: MatrixEvent | null, presenceUser: User) => {
      if (presenceUser.userId === userId) update();
    };
    client.on(UserEvent.Presence, clientUpdate);

    return () => {
      user?.off(UserEvent.Presence, update);
      client.off(UserEvent.Presence, clientUpdate);
    };
  }, [userId]);

  return state;
}
