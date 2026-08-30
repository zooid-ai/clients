import { useEffect, useRef } from "react";
import { useTimeline } from "../../hooks/use-timeline";
import { useFillGap } from "../../hooks/use-fill-gap";
import { useLoadMoreHistory } from "../../hooks/use-load-more-history";
import { LoadMoreButton } from "../timeline/load-more-button";
import { RoomBanner } from "./room-banner";
import { MessagePanel } from "./message-panel";

export function TimelinePanel({
  roomId,
  onReplyInThread,
  onViewThread,
}: {
  roomId: string;
  onReplyInThread?: (eventId: string) => void;
  onViewThread?: (eventId: string) => void;
}) {
  const { events, pendingRootIds, gapBeforeEventIds } = useTimeline(roomId);
  const { loadMore, loading, hasMore } = useLoadMoreHistory(roomId);
  const { fillGap, pendingGapId } = useFillGap(roomId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prefetchedRef = useRef<string | null>(null);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [events]);

  // One-shot prefetch on room open: walk back once so the timeline settles at
  // the start of history before deciding whether to show the banner. Don't mark
  // as prefetched when hasMore is false — the token may not have arrived yet
  // (timing race on room switch), and we want to re-fire once it does.
  useEffect(() => {
    if (prefetchedRef.current === roomId) return;
    if (!hasMore) return;
    prefetchedRef.current = roomId;
    void loadMore();
  }, [roomId, hasMore, loadMore]);

  return (
    <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
      {!hasMore && <RoomBanner roomId={roomId} emptyRoom={events.length === 0} />}
      {events.length > 0 && hasMore && (
        <LoadMoreButton loading={loading} hasMore={hasMore} onClick={loadMore} />
      )}
      <MessagePanel
        events={events}
        pendingRootIds={pendingRootIds}
        gapBeforeEventIds={gapBeforeEventIds}
        pendingGapId={pendingGapId}
        onFillGap={fillGap}
        onReplyInThread={onReplyInThread}
        onViewThread={onViewThread}
      />
    </div>
  );
}
