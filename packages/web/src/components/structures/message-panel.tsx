import type { MatrixEvent } from "matrix-js-sdk";
import { EventTile } from "../timeline/event-tile";

export function MessagePanel({ events }: { events: MatrixEvent[] }) {
  return (
    <ol className="message-panel">
      {events.map((ev) => (
        <li key={ev.getId() ?? `${ev.getType()}-${ev.getTs()}`}>
          <EventTile event={ev} />
        </li>
      ))}
    </ol>
  );
}
