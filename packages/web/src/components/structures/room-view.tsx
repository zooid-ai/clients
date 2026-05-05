import { useParams } from "react-router-dom";
import { Composer } from "../rooms/composer";
import { TimelinePanel } from "./timeline-panel";

export function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  if (!roomId) return <div>No room selected</div>;
  return (
    <article className="room-view">
      <TimelinePanel roomId={roomId} />
      <Composer roomId={roomId} />
    </article>
  );
}
