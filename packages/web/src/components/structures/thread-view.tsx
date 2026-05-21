import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useThread } from "../../hooks/use-timeline";
import { useLoadMoreThread } from "../../hooks/use-load-more-thread";
import { EventTile } from "../timeline/event-tile";
import { LoadMoreButton } from "../timeline/load-more-button";

const PREFETCH_THRESHOLD = 5;

function MessageSkeleton() {
  return (
    <div className="flex gap-2 py-1.5" aria-busy="true" aria-label="Loading thread parent">
      <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-muted animate-pulse" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3 w-24 rounded bg-muted animate-pulse" />
        <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export function ThreadView({
  roomId,
  rootEventId,
  onBack,
}: {
  roomId: string;
  rootEventId: string;
  onBack: () => void;
}) {
  const { root, rootPending, events, totalCount } = useThread(roomId, rootEventId);
  const { loadMore, loading } = useLoadMoreThread(roomId, rootEventId);
  const hasMore = events.length < totalCount;
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

  // One-shot prefetch on thread open: if the rendered reply count is below the
  // threshold and the server says there are more, walk back one page so the
  // user doesn't land on a near-empty thread when older replies exist.
  useEffect(() => {
    const key = `${roomId}:${rootEventId}`;
    if (prefetchedRef.current === key) return;
    if (events.length === 0 && rootPending) return; // wait for thread to materialize
    if (hasMore && events.length < PREFETCH_THRESHOLD) {
      prefetchedRef.current = key;
      void loadMore();
    } else if (!hasMore || events.length >= PREFETCH_THRESHOLD) {
      prefetchedRef.current = key;
    }
  }, [roomId, rootEventId, hasMore, events.length, rootPending, loadMore]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to room"
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-sm font-medium">
          Thread {totalCount > 0 ? `(${totalCount} ${totalCount === 1 ? "event" : "events"})` : ""}
        </span>
      </header>
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto">
        {events.length > 0 && (
          <LoadMoreButton loading={loading} hasMore={hasMore} onClick={loadMore} />
        )}
        <ol className="flex flex-col gap-0.5 px-4 py-3">
          <li>
            {root ? (
              <EventTile event={root} disableThreadAffordances />
            ) : rootPending ? (
              <MessageSkeleton />
            ) : (
              <div className="text-sm text-muted-foreground italic py-2">
                Thread root unavailable.
              </div>
            )}
          </li>
          {events.map((ev) => (
            <li key={ev.getId() ?? `${ev.getType()}-${ev.getTs()}`}>
              <EventTile event={ev} disableThreadAffordances />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
