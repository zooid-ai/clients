import type { MatrixEvent } from "matrix-js-sdk";
import { decodeEcoZoonEvent, isEcoZoonLifecycle } from "../../events/eco-zoon";
import { EcoZoonEventTile } from "./eco-zoon-event";
import { TextMessage } from "./text-message";

export function EventTile({ event }: { event: MatrixEvent }) {
  if (event.getType() === "m.room.message") {
    return <TextMessage event={event} />;
  }
  if (isEcoZoonLifecycle(event)) {
    const decoded = decodeEcoZoonEvent(event);
    if (!decoded) return null;
    return <EcoZoonEventTile decoded={decoded} sender={event.getSender() ?? "?"} />;
  }
  return null;
}
