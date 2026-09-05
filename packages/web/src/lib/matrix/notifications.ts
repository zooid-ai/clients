import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";

const MAX_BODY = 140;

// Agent event types that ever notify. tool_call, turn.start and
// agent_message_chunk are high-frequency progress signals and are
// deliberately excluded — never listed here, never notified.
const AGENT_EVENT_TYPES = new Set([
  "dev.zooid.approval_request",
  "dev.zooid.turn.end",
  "dev.zooid.error",
]);

export interface DesktopNotificationPayload {
  roomId: string;
  eventId: string;
  title: string;
  body: string;
}

function truncate(body: string): string {
  return body.length > MAX_BODY ? `${body.slice(0, MAX_BODY - 1)}…` : body;
}

/** Agents' MXIDs are their own display name as the localpart; fall back to it when no room member state names them. */
function agentNameFor(room: Room, senderId: string): string {
  return room.getMember(senderId)?.name ?? senderId.replace(/^@/, "").split(":")[0];
}

export function evaluateNotification(
  client: MatrixClient,
  room: Room,
  event: MatrixEvent,
): DesktopNotificationPayload | null {
  const type = event.getType();
  if (type !== "m.room.message" && !AGENT_EVENT_TYPES.has(type)) return null;
  if (event.getSender() === client.getUserId()) return null;
  const actions = client.getPushActionsForEvent(event);
  if (!actions?.notify) return null;

  const senderId = event.getSender()!;
  const content = event.getContent();

  let body: string;
  if (type === "m.room.message") {
    const sender = room.getMember(senderId)?.name ?? senderId;
    const text = typeof content.body === "string" ? (content.body as string) : "New message";
    body = `${sender}: ${text}`;
  } else if (type === "dev.zooid.approval_request") {
    // No prose to preview — tool_title is the closest thing to a summary.
    const title = typeof content.tool_title === "string" ? (content.tool_title as string) : "a tool call";
    body = `${agentNameFor(room, senderId)} needs approval: ${title}`;
  } else {
    // dev.zooid.turn.end / dev.zooid.error already carry a human-readable
    // body from the daemon (toTurnEndBody / toErrorBody).
    body =
      typeof content.body === "string"
        ? (content.body as string)
        : `${agentNameFor(room, senderId)} sent an update`;
  }

  return {
    roomId: room.roomId,
    eventId: event.getId()!,
    title: room.name,
    body: truncate(body),
  };
}
