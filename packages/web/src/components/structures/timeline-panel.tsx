import { useEffect, useRef } from "react";
import { useTimeline } from "../../hooks/use-timeline";
import { useLoadMoreHistory } from "../../hooks/use-load-more-history";
import { LoadMoreButton } from "../timeline/load-more-button";
import { MessagePanel } from "./message-panel";

const PREFETCH_THRESHOLD = 5;

export function TimelinePanel({
  roomId,
  onReplyInThread,
  onViewThread,
}: {
  roomId: string;
  onReplyInThread?: (eventId: string) => void;
  onViewThread?: (eventId: string) => void;
}) {
  const { events, pendingRootIds } = useTimeline(roomId);
  const { loadMore, loading, hasMore } = useLoadMoreHistory(roomId);
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

  // One-shot prefetch on room open: if the room has a back-pagination token
  // and we're showing fewer than PREFETCH_THRESHOLD events, walk back once so
  // the timeline doesn't land near-empty when older history exists.
  useEffect(() => {
    if (prefetchedRef.current === roomId) return;
    if (hasMore && events.length < PREFETCH_THRESHOLD) {
      prefetchedRef.current = roomId;
      void loadMore();
    } else if (!hasMore || events.length >= PREFETCH_THRESHOLD) {
      prefetchedRef.current = roomId;
    }
  }, [roomId, hasMore, events.length, loadMore]);

  return (
    <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
      {events.length > 0 && (
        <LoadMoreButton loading={loading} hasMore={hasMore} onClick={loadMore} />
      )}
      <MessagePanel
        events={events}
        pendingRootIds={pendingRootIds}
        onReplyInThread={onReplyInThread}
        onViewThread={onViewThread}
      />
    </div>
  );
}
