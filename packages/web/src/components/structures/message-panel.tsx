import { Fragment } from "react";
import type { MatrixEvent } from "matrix-js-sdk";
import { useNow } from "@/hooks/use-now";
import { formatDayDivider, isSameDay } from "@/lib/time";
import { DateDivider } from "../timeline/date-divider";
import { EventTile } from "../timeline/event-tile";

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

export function MessagePanel({
  events,
  pendingRootIds,
  onReplyInThread,
  onViewThread,
}: {
  events: MatrixEvent[];
  pendingRootIds?: string[];
  onReplyInThread?: (eventId: string) => void;
  onViewThread?: (eventId: string) => void;
}) {
  const now = useNow();
  return (
    <ol className="flex flex-col gap-0.5 px-4 py-3">
      {pendingRootIds?.map((id) => (
        <li key={`skeleton-${id}`}>
          <MessageSkeleton />
        </li>
      ))}
      {events.map((ev, i) => {
        const prev = events[i - 1];
        const showDay = !prev || !isSameDay(prev.getTs(), ev.getTs());
        return (
          <Fragment key={ev.getId() ?? `${ev.getType()}-${ev.getTs()}`}>
            {showDay && (
              <li className="contents">
                <DateDivider label={formatDayDivider(ev.getTs(), now)} />
              </li>
            )}
            <li className="contents">
              <EventTile event={ev} onReplyInThread={onReplyInThread} onViewThread={onViewThread} />
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
