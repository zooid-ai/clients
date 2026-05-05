import type { MatrixEvent } from "matrix-js-sdk";

export function TextMessage({ event }: { event: MatrixEvent }) {
  const c = event.getContent() as { msgtype?: string; body?: string };
  if (c.msgtype !== "m.text") return null;
  return (
    <div className="text-message">
      <span className="text-message__sender">{event.getSender()}</span>
      <span className="text-message__body">{c.body}</span>
    </div>
  );
}
