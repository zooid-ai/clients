import type { MatrixEvent } from "matrix-js-sdk";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <Card data-testid="approval-card" className="my-2 max-w-xl">
        <CardHeader>
          <CardTitle>Approval request</CardTitle>
          <CardDescription>
            {resolution.decision === "allow" ? "Approved" : "Cancelled"} by{" "}
            <span>{resolution.respondedBy}</span>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card data-testid="approval-card" className="my-2 max-w-xl">
      <CardHeader>
        <CardTitle>Approval request</CardTitle>
        <CardDescription>
          session {decoded.sessionId} · tool-call {decoded.toolCallId}
        </CardDescription>
      </CardHeader>
      {error && (
        <CardContent>
          <div role="alert" className="text-destructive text-sm">
            {error}
          </div>
        </CardContent>
      )}
      {!canApprove ? (
        <CardContent>
          <p className="text-muted-foreground text-sm">
            You have insufficient permission to respond to this approval.
          </p>
        </CardContent>
      ) : (
        <CardFooter className="gap-2">
          <Button
            type="button"
            disabled={state === "sending"}
            onClick={() => send("allow")}
          >
            Allow
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={state === "sending"}
            onClick={() => send("cancel")}
          >
            Cancel
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
