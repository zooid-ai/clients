import type { MatrixEvent } from "matrix-js-sdk";
import { ApprovalEventType } from "../../events/approval";
import { decodeEcoZoonEvent, isEcoZoonLifecycle } from "../../events/eco-zoon";
import { ApprovalCard } from "./approval-card";
import { EcoZoonEventTile } from "./eco-zoon-event";
import { TextMessage } from "./text-message";

export function EventTile({ event }: { event: MatrixEvent }) {
  if (event.getType() === "m.room.message") return <TextMessage event={event} />;
  if (event.getType() === ApprovalEventType.Request) return <ApprovalCard event={event} />;
  // Approval *responses* are not rendered as their own tile — they only matter
  // as input to <ApprovalCard /> resolution. Skip silently.
  if (event.getType() === ApprovalEventType.Response) return null;
  if (isEcoZoonLifecycle(event)) {
    const decoded = decodeEcoZoonEvent(event);
    if (!decoded) return null;
    return <EcoZoonEventTile decoded={decoded} sender={event.getSender() ?? "?"} />;
  }
  return null;
}
