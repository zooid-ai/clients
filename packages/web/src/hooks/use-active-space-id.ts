import { useEffect, useState } from "react";
import { MatrixClientPeg } from "../client/peg";
import { clientExt } from "../client/client-ext";
import { isValidWorkforceSpace } from "../client/runtime-config";

interface ActiveSpace {
  ready: boolean;
  spaceId: string | null;
}

export function useActiveSpaceId(spaceLocalpart: string, serverName: string): ActiveSpace {
  const [state, setState] = useState<ActiveSpace>({ ready: false, spaceId: null });

  useEffect(() => {
    let cancelled = false;
    if (!isValidWorkforceSpace(spaceLocalpart)) {
      setState({ ready: true, spaceId: null });
      return;
    }
    void (async () => {
      const client = MatrixClientPeg.safeGet();
      if (!client) return;
      const alias = `#${spaceLocalpart}:${serverName}`;
      try {
        const resolved = await clientExt(client).getRoomIdForAlias(alias);
        if (cancelled) return;
        if (!resolved) {
          setState({ ready: true, spaceId: null });
          return;
        }
        const roomId = resolved.room_id;
        if (!client.getRoom(roomId)) {
          await clientExt(client).joinRoom(alias);
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
