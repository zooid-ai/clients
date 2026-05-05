import { ScrollArea } from "@/components/ui/scroll-area";
import { useTimeline } from "../../hooks/use-timeline";
import { MessagePanel } from "./message-panel";

export function TimelinePanel({ roomId }: { roomId: string }) {
  const { events } = useTimeline(roomId);
  return (
    <ScrollArea className="h-full">
      <MessagePanel events={events} />
    </ScrollArea>
  );
}
