import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MatrixClientPeg } from "../client/peg";
import { clientExt } from "../client/client-ext";

/** Shared join + navigate + error path (ZNC023). Returns the joined roomId or null. */
export function useJoinRoom() {
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinRoom = useCallback(
    async (idOrAlias: string, opts?: { search?: string }): Promise<string | null> => {
      const client = MatrixClientPeg.safeGet();
      if (!client) return null;
      setJoining(true);
      setError(null);
      try {
        const room = await clientExt(client).joinRoom(idOrAlias);
        navigate(`/room/${room.roomId}${opts?.search ?? ""}`);
        return room.roomId;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not join that room.");
        return null;
      } finally {
        setJoining(false);
      }
    },
    [navigate],
  );

  return { joinRoom, joining, error };
}
