import { useEffect, useRef } from "react";
import { useTimeline } from "../../hooks/use-timeline";
import { MessagePanel } from "./message-panel";

export function TimelinePanel({ roomId }: { roomId: string }) {
  const { events } = useTimeline(roomId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

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

  return (
    <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
      <MessagePanel events={events} />
    </div>
  );
}
