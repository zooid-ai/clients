import { useCallback, useEffect, useState } from "react";
import { Direction, type EventTimeline, RoomEvent } from "matrix-js-sdk";
import { MatrixClientPeg } from "../client/peg";

interface State {
  loading: boolean;
  hasMore: boolean;
}

/**
 * The timeline that actually holds this thread's replies.
 *
 * matrix-js-sdk only builds a Thread (with its own EventTimelineSet) when the
 * client is created with `threadSupport: true`. We don't set it — with thread
 * support off, Room.partitionThreadedEvents keeps every reply in the main room
 * timeline and `room.getThread()` returns nothing at all. So the room's live
 * timeline is where we have to paginate; bailing on a null Thread is what made
 * the ThreadView "Load more" button a permanent no-op (zooid-ai/zooid#14).
 *
 * The Thread branch is kept so this keeps working if thread support is turned
 * on later.
 */
function threadTimeline(roomId: string, rootEventId: string): EventTimeline | null {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!room) return null;
  const thread = room.getThread(rootEventId);
  return thread ? thread.liveTimeline : room.getLiveTimeline();
}

function snapshotHasMore(roomId: string, rootEventId: string): boolean {
  const timeline = threadTimeline(roomId, rootEventId);
  return timeline?.getPaginationToken(Direction.Backward) != null;
}

/**
 * Backward-paginates until this thread's older replies are loaded.
 *
 * `hasMore` here means "there is somewhere left to paginate from", which is
 * necessary but not sufficient: ThreadView pairs it with
 * `events.length < totalCount` (the server's bundled relation count) to decide
 * whether more replies are actually outstanding. Tracking exhaustion matters
 * because the replies may sit far behind the sync window — the button has to
 * stay clickable across several pages, but must stop offering itself once we
 * reach the start of the room.
 */
export function useLoadMoreThread(roomId: string, rootEventId: string, limit = 50) {
  const [state, setState] = useState<State>(() => ({
    loading: false,
    hasMore: snapshotHasMore(roomId, rootEventId),
  }));

  // The back-pagination token arrives with sync, so hasMore can flip
  // false → true after mount (and true → false once we paginate to the start).
  useEffect(() => {
    setState((s) => ({ ...s, hasMore: snapshotHasMore(roomId, rootEventId) }));
    const client = MatrixClientPeg.safeGet();
    const room = client?.getRoom(roomId);
    if (!room) return;
    const onTimeline = () => {
      setState((s) => {
        const next = snapshotHasMore(roomId, rootEventId);
        return next === s.hasMore ? s : { ...s, hasMore: next };
      });
    };
    room.on(RoomEvent.Timeline, onTimeline);
    room.on(RoomEvent.TimelineReset, onTimeline);
    return () => {
      room.off(RoomEvent.Timeline, onTimeline);
      room.off(RoomEvent.TimelineReset, onTimeline);
    };
  }, [roomId, rootEventId]);

  const loadMore = useCallback(async () => {
    if (state.loading) return;
    const client = MatrixClientPeg.safeGet();
    const timeline = threadTimeline(roomId, rootEventId);
    if (!client || !timeline) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const more = await client.paginateEventTimeline(timeline, {
        backwards: true,
        limit,
      });
      setState({ loading: false, hasMore: more });
    } catch (err) {
      console.warn(`[useLoadMoreThread] paginate(${roomId}, ${rootEventId}) failed:`, err);
      setState({ loading: false, hasMore: false });
    }
  }, [roomId, rootEventId, limit, state.loading]);

  return { loadMore, loading: state.loading, hasMore: state.hasMore };
}
