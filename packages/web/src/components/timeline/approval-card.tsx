import type { MatrixEvent } from "matrix-js-sdk";
import { ApprovalEventType, decodeApprovalRequest } from "../../events/approval";
import { useApproval } from "../../hooks/use-approval";
import { useMyPowerLevel } from "../../hooks/use-my-power-level";

export function ApprovalCard({ event }: { event: MatrixEvent }) {
  const decoded = decodeApprovalRequest(event);
  const roomId = event.getRoomId() ?? "";
  const power = useMyPowerLevel(roomId);
  const { state, resolution, error, send } = useApproval(event);

  if (!decoded) return null;
  const canApprove = power.canSendEvent(ApprovalEventType.Response);

  if (state === "resolved" && resolution) {
    return (
      <div className="approval-card approval-card--resolved" data-testid="approval-card">
        <div className="approval-card__title">Approval request</div>
        <div className="approval-card__resolution">
          {resolution.decision === "allow" ? "Approved" : "Cancelled"} by{" "}
          <span>{resolution.respondedBy}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="approval-card" data-testid="approval-card">
      <div className="approval-card__title">Approval request</div>
      <div className="approval-card__meta">
        session {decoded.sessionId} · tool-call {decoded.toolCallId}
      </div>
      {error && <div role="alert">{error}</div>}
      {!canApprove ? (
        <div className="approval-card__noperm">
          You have insufficient permission to respond to this approval.
        </div>
      ) : (
        <div className="approval-card__actions">
          <button
            type="button"
            disabled={state === "sending"}
            onClick={() => send("allow")}
          >
            Allow
          </button>
          <button
            type="button"
            disabled={state === "sending"}
            onClick={() => send("cancel")}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
