import type { MatrixEvent } from "matrix-js-sdk";
import { ApprovalEventType } from "../../events/approval";
import { decodeZooidEvent, isZooidLifecycle } from "../../events/zooid-events";
import { ApprovalCard } from "./approval-card";
import { ZooidEventTile } from "./zooid-event";
import { ErrorTile } from "./error-tile";
import { MediaMessage } from "./media-message";
import { MembershipEvent } from "./membership-event";
import { SessionDivider } from "./session-divider";
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
  if (event.getType() === "dev.zooid.session_reset") {
    return <SessionDivider label="new session" />;
  }
  if (event.getType() === "m.room.member") {
    return <MembershipEvent event={event} />;
  }
  if (isZooidLifecycle(event)) {
    const decoded = decodeZooidEvent(event);
    if (!decoded) return null;
    if (decoded.kind === "error") {
      return <ErrorTile decoded={decoded} />;
    }
    return (
      <ZooidEventTile
        decoded={decoded}
        sender={event.getSender() ?? "?"}
        roomId={event.getRoomId() ?? ""}
        ts={event.getTs()}
      />
    );
  }
  return null;
}
