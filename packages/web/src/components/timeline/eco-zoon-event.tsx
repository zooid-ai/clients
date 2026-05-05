import { useState } from "react";
import type { DecodedEcoZoonEvent } from "../../events/eco-zoon";

interface Props {
  decoded: DecodedEcoZoonEvent;
  sender: string;
}

// MVP rendering: minimal but visible. ZNC002 layers richer presentation.
export function EcoZoonEventTile({ decoded, sender }: Props) {
  switch (decoded.kind) {
    case "session.start":
      return <div className="eco-event">{sender} started session</div>;

    case "turn.start":
      return <div className="eco-event">{sender} started a turn</div>;

    case "message_chunk":
      return (
        <div className="eco-event eco-event--chunk">
          <span className="eco-event__sender">{sender}</span>
          <span className="eco-event__body">{decoded.content}</span>
        </div>
      );

    case "tool_call":
      return <ToolCallCard decoded={decoded} sender={sender} />;

    case "tool_call_update":
      return (
        <div className="eco-event eco-event--update">
          {decoded.toolCallId} → {decoded.status}
          {decoded.content ? `: ${decoded.content}` : null}
        </div>
      );

    case "plan":
      return (
        <ul className="eco-event eco-event--plan">
          {decoded.entries.map((e) => (
            <li key={e.id} data-status={e.status}>
              {e.title}
            </li>
          ))}
        </ul>
      );

    case "turn.end":
      return (
        <div className="eco-event">
          {sender} ended turn{decoded.stopReason ? ` (${decoded.stopReason})` : ""}
        </div>
      );
  }
}

function ToolCallCard({
  decoded,
  sender,
}: {
  decoded: Extract<DecodedEcoZoonEvent, { kind: "tool_call" }>;
  sender: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tool-call">
      <button type="button" onClick={() => setOpen((o) => !o)}>
        {decoded.title}
      </button>
      {open && (
        <div className="tool-call__body">
          <div>kind: {decoded.toolKind}</div>
          <div>by: {sender}</div>
          <div>id: {decoded.toolCallId}</div>
        </div>
      )}
    </div>
  );
}
