import { useEffect, useState } from "react";
import { MatrixClientPeg } from "../client/peg";

interface ActiveSpace {
  ready: boolean;
  spaceId: string | null;
}

export function useActiveSpaceId(spaceLocalpart: string, serverName: string): ActiveSpace {
  const [state, setState] = useState<ActiveSpace>({ ready: false, spaceId: null });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = MatrixClientPeg.safeGet();
      if (!client) return;
      const alias = `#${spaceLocalpart}:${serverName}`;
      try {
        const resolved = await (
          client as unknown as { getRoomIdForAlias: (a: string) => Promise<{ room_id: string } | null> }
        ).getRoomIdForAlias(alias);
        if (cancelled) return;
        if (!resolved) {
          setState({ ready: true, spaceId: null });
          return;
        }
        const roomId = resolved.room_id;
        if (!client.getRoom(roomId)) {
          await (client as unknown as { joinRoom: (a: string) => Promise<unknown> }).joinRoom(alias);
        }
        if (!cancelled) setState({ ready: true, spaceId: roomId });
      } catch {
        if (!cancelled) setState({ ready: true, spaceId: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceLocalpart, serverName]);

  return state;
}
