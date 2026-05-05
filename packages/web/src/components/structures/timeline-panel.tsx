import { useTimeline } from "../../hooks/use-timeline";
import { MessagePanel } from "./message-panel";
import { ScrollPanel } from "./scroll-panel";

export function TimelinePanel({ roomId }: { roomId: string }) {
  const { events } = useTimeline(roomId);
  return (
    <ScrollPanel>
      <MessagePanel events={events} />
    </ScrollPanel>
  );
}
