import { useCallback, useState } from "react";
import { Direction, type EventTimeline } from "matrix-js-sdk";
import { MatrixClientPeg } from "../client/peg";

/**
 * The earliest timeline joined to `timeline`. Its backward edge is the hole
 * nearest above it. A timeline that has been joined from below has had its
 * own backward token nulled, and paginateEventTimeline reads a null token as
 * "from the latest event", which walks away from the hole.
 */
function chainHead(timeline: EventTimeline): EventTimeline {
  const seen = new Set([timeline]);
  let head = timeline;
  for (
    let prev = head.getNeighbouringTimeline(Direction.Backward);
    prev && !seen.has(prev);
    prev = prev.getNeighbouringTimeline(Direction.Backward)
  ) {
    seen.add(prev);
    head = prev;
  }
  return head;
}

/**
 * Backfills a hole in the room's history.
 *
 * Unlike useLoadMoreHistory, which always paginates the oldest timeline, this
 * paginates the hole nearest above `eventId`. In the room that is the timeline
 * beginning at `eventId`, the one sitting on the far side of the gap. In a
 * thread it can be a timeline already joined above it, so we walk to the head
 * of the chain. One hook for both surfaces, no thread variant. Paginating it
 * backwards walks into the hole and,
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
      const anchored = room.getUnfilteredTimelineSet().getTimelineForEvent(eventId);
      if (!anchored) return;
      const timeline = chainHead(anchored);
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
