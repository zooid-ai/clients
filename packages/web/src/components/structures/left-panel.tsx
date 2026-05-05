import { Link } from "react-router-dom";
import { useRoomList } from "../../hooks/use-room-list";

export function LeftPanel() {
  const rooms = useRoomList();
  return (
    <nav className="left-panel" aria-label="Rooms">
      <ul>
        {rooms.map((room) => (
          <li key={room.roomId}>
            <Link to={`/room/${room.roomId}`}>{room.name || room.roomId}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
