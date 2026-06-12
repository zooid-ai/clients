import type { MatrixEvent } from "matrix-js-sdk";
import { ApprovalEventType } from "../../events/approval";
import { decodeEcoZoonEvent, isEcoZoonLifecycle } from "../../events/eco-zoon";
import { ApprovalCard } from "./approval-card";
import { EcoZoonEventTile } from "./eco-zoon-event";
import { ErrorTile } from "./error-tile";
import { MediaMessage } from "./media-message";
import { TextMessage } from "./text-message";

const MEDIA_MSGTYPES = new Set(["m.image", "m.file", "m.video", "m.audio"]);

export function EventTile({
  event,
  onReplyInThread,
  onViewThread,
  disableThreadAffordances,
}: {
  event: MatrixEvent;
  onReplyInThread?: (eventId: string) => void;
  onViewThread?: (eventId: string) => void;
  disableThreadAffordances?: boolean;
}) {
  if (event.getType() === "m.room.message") {
    const msgtype = (event.getContent() as { msgtype?: string }).msgtype;
    if (msgtype && MEDIA_MSGTYPES.has(msgtype)) {
      return <MediaMessage event={event} />;
    }
    return (
      <TextMessage
        event={event}
        onReplyInThread={onReplyInThread}
        onViewThread={onViewThread}
        disableThreadAffordances={disableThreadAffordances}
      />
    );
  }
  if (event.getType() === ApprovalEventType.Request) return <ApprovalCard event={event} />;
  // Approval *responses* are not rendered as their own tile — they only matter
  // as input to <ApprovalCard /> resolution. Skip silently.
  if (event.getType() === ApprovalEventType.Response) return null;
  if (event.getType() === "eco.zoon.session_reset") {
    return (
      <div className="flex items-center gap-2 py-3 text-xs uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>new session</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }
  if (isEcoZoonLifecycle(event)) {
    const decoded = decodeEcoZoonEvent(event);
    if (!decoded) return null;
    if (decoded.kind === "error") {
      return <ErrorTile decoded={decoded} />;
    }
    return (
      <EcoZoonEventTile
        decoded={decoded}
        sender={event.getSender() ?? "?"}
        roomId={event.getRoomId() ?? ""}
        ts={event.getTs()}
      />
    );
  }
  return null;
}
