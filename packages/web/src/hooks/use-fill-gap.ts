import { useCallback, useState } from "react";
import { MatrixClientPeg } from "../client/peg";

/**
 * Backfills a hole in the room's history.
 *
 * Unlike useLoadMoreHistory, which always paginates the *live* timeline, this
 * paginates the specific timeline that begins at `eventId` — the one sitting
 * on the far side of the gap. Paginating it backwards walks into the hole and,
 * once it reaches events the room already has, the SDK joins the two timelines
 * and the marker disappears on its own.
 *
 * One page per click, deliberately: a gap wider than `limit` needs another
 * press rather than an unbounded loop that could paginate the whole room.
 */
export function useFillGap(roomId: string, limit = 50) {
  const [pendingGapId, setPendingGapId] = useState<string | null>(null);

  const fillGap = useCallback(
    async (eventId: string) => {
      if (pendingGapId) return;
      const client = MatrixClientPeg.safeGet();
      const room = client?.getRoom(roomId);
      if (!client || !room) return;
      const timeline = room.getUnfilteredTimelineSet().getTimelineForEvent(eventId);
      if (!timeline) return;
      setPendingGapId(eventId);
      try {
        await client.paginateEventTimeline(timeline, { backwards: true, limit });
      } catch (err) {
        console.warn(`[useFillGap] paginate(${roomId}, ${eventId}) failed:`, err);
      } finally {
        setPendingGapId(null);
      }
    },
    [roomId, limit, pendingGapId],
  );

  return { fillGap, pendingGapId };
}
