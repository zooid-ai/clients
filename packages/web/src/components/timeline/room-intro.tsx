import { MatrixClientPeg } from "../../client/peg";
import { useRoomTopic } from "../../hooks/use-room-topic";
import { RoomAvatar } from "../room-avatar";

export function RoomIntro({ roomId }: { roomId: string }) {
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  const name = room?.name ?? roomId;
  const topic = useRoomTopic(roomId);

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <RoomAvatar roomId={roomId} name={name} size="lg" />
      <div>
        <p className="text-sm text-muted-foreground">This is the start of</p>
        <p className="font-semibold">{name}</p>
        {topic && <p className="mt-1 text-sm text-muted-foreground">{topic}</p>}
      </div>
    </div>
  );
}
