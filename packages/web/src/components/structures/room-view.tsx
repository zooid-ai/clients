import { useParams } from "react-router-dom";
import { Composer } from "../rooms/composer";
import { TimelinePanel } from "./timeline-panel";

export function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  if (!roomId) return <div>No room selected</div>;
  return (
    <article className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <TimelinePanel roomId={roomId} />
      </div>
      <Composer roomId={roomId} />
    </article>
  );
}
