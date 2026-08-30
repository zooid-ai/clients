import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useThread } from "../../hooks/use-timeline";
import { useLoadMoreThread } from "../../hooks/use-load-more-thread";
import { EventTile } from "../timeline/event-tile";
import { LoadMoreButton } from "../timeline/load-more-button";

const PREFETCH_THRESHOLD = 5;
/**
 * With thread support off the replies live in the main room timeline, so an
 * old thread's replies can sit well behind the sync window — one page of 50
 * often isn't enough to reach them. Walk back a few pages, but bounded, so a
 * thread whose totalCount we can never satisfy doesn't paginate the whole room.
 */
const MAX_PREFETCH_PAGES = 5;

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
  const { loadMore, loading, hasMore: canPaginate } = useLoadMoreThread(roomId, rootEventId);
  // Two conditions, both required: the server says replies are outstanding,
  // and there's somewhere left to paginate from. Offering the button on the
  // first alone leaves a dead control on screen once we've reached the start
  // of the room and still can't account for every reply.
  const hasMore = events.length < totalCount && canPaginate;
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prefetchPagesRef = useRef<{ key: string; pages: number }>({ key: "", pages: 0 });

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

  // Prefetch on thread open: if the rendered reply count is below the
  // threshold and the server says there are more, walk back a page at a time
  // so the user doesn't land on a near-empty thread when older replies exist.
  // Bounded by MAX_PREFETCH_PAGES; past that it's the user's call via the
  // button.
  useEffect(() => {
    const key = `${roomId}:${rootEventId}`;
    if (prefetchPagesRef.current.key !== key) {
      prefetchPagesRef.current = { key, pages: 0 };
    }
    if (events.length === 0 && rootPending) return; // wait for thread to materialize
    if (loading) return;
    if (!hasMore || events.length >= PREFETCH_THRESHOLD) return;
    if (prefetchPagesRef.current.pages >= MAX_PREFETCH_PAGES) return;
    prefetchPagesRef.current.pages += 1;
    void loadMore();
  }, [roomId, rootEventId, hasMore, events.length, rootPending, loading, loadMore]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
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
        {/* Not gated on events.length: a thread whose replies are all behind
            the sync window renders zero of them, and that is exactly when the
            user needs the button. LoadMoreButton hides itself when idle with
            nothing more to fetch. */}
        <LoadMoreButton loading={loading} hasMore={hasMore} onClick={loadMore} />
        <ol className="flex flex-col gap-0.5 px-4 py-3">
          {root ? (
            <li className="contents">
              <EventTile event={root} disableThreadAffordances />
            </li>
          ) : rootPending ? (
            <li>
              <MessageSkeleton />
            </li>
          ) : (
            <li>
              <div className="text-sm text-muted-foreground italic py-2">
                Thread root unavailable.
              </div>
            </li>
          )}
          {events.map((ev) => (
            <li key={ev.getId() ?? `${ev.getType()}-${ev.getTs()}`} className="contents">
              <EventTile event={ev} disableThreadAffordances />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
