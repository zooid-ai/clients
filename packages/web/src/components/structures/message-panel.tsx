import type { MatrixEvent } from "matrix-js-sdk";
import { EventTile } from "../timeline/event-tile";

export function MessagePanel({ events }: { events: MatrixEvent[] }) {
  return (
    <ol className="flex flex-col gap-0.5 px-4 py-3">
      {events.map((ev) => (
        <li key={ev.getId() ?? `${ev.getType()}-${ev.getTs()}`}>
          <EventTile event={ev} />
        </li>
      ))}
    </ol>
  );
}
