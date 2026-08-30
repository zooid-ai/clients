import { useCallback, useEffect, useState } from "react";
import { ClientEvent, Direction, type Room, RoomEvent } from "matrix-js-sdk";
import { MatrixClientPeg } from "../client/peg";

interface State {
  loading: boolean;
  hasMore: boolean;
}

function snapshotHasMore(roomId: string): boolean {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  if (!room) return false;
  // Brand-new rooms don't yet have a back-pagination token, so showing "Load
  // more" at the top of an empty conversation is misleading. Derive from the
  // live timeline's prev_batch instead of optimistically assuming true.
  return room.getLiveTimeline().getPaginationToken(Direction.Backward) !== null;
}

/**
 * Backward-paginates the room's live timeline by `limit` events per call.
 * matrix-js-sdk emits Room.timeline for each new event, so consumers using
 * useTimeline / useThread will pick up the additions automatically.
 */
export function useLoadMoreHistory(roomId: string, limit = 50) {
  const [state, setState] = useState<State>(() => ({
    loading: false,
    hasMore: snapshotHasMore(roomId),
  }));

  // Sync hasMore with the live timeline: when sync delivers a prev_batch we
  // may flip from false → true; after the user paginates to the start we'll
  // flip true → false via the paginate result below.
  useEffect(() => {
    const client = MatrixClientPeg.safeGet();
    if (!client) return;

    const sync = () => {
      setState((s) => {
        const next = snapshotHasMore(roomId);
        return next === s.hasMore ? s : { ...s, hasMore: next };
      });
    };

    let attached: Room | null = null;
    const detach = () => {
      attached?.off(RoomEvent.Timeline, sync);
      attached?.off(RoomEvent.TimelineReset, sync);
      attached = null;
    };
    const attach = (room: Room) => {
      if (attached === room) return;
      detach();
      attached = room;
      room.on(RoomEvent.Timeline, sync);
      // A gappy sync swaps the live timeline for a fresh one carrying a new
      // prev_batch, without emitting a single Timeline event.
      room.on(RoomEvent.TimelineReset, sync);
    };

    // Navigating straight to /room/:roomId after login routinely mounts this
    // before sync has delivered the room. Bailing out permanently in that case
    // left hasMore stuck at false for the life of the mount — no prefetch, and
    // no "Load more" button to recover with, so the timeline stayed pinned to
    // whatever the initial sync window happened to contain (zooid-ai/zooid#14).
    const onRoom = (room: Room) => {
      if (room.roomId !== roomId) return;
      attach(room);
      sync();
    };
    client.on(ClientEvent.Room, onRoom);

    const existing = client.getRoom(roomId);
    if (existing) attach(existing);
    sync();

    return () => {
      client.off(ClientEvent.Room, onRoom);
      detach();
    };
  }, [roomId]);

  const loadMore = useCallback(async () => {
    if (state.loading || !state.hasMore) return;
    const client = MatrixClientPeg.safeGet();
    const room = client?.getRoom(roomId);
    if (!client || !room) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const timeline = room.getLiveTimeline();
      const more = await client.paginateEventTimeline(timeline, {
        backwards: true,
        limit,
      });
      setState({ loading: false, hasMore: more });
    } catch (err) {
      console.warn(`[useLoadMoreHistory] paginate(${roomId}) failed:`, err);
      setState({ loading: false, hasMore: false });
    }
  }, [roomId, limit, state.loading, state.hasMore]);

  return { loadMore, loading: state.loading, hasMore: state.hasMore };
}
