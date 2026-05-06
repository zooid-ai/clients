import type { MatrixEvent } from "matrix-js-sdk";
import { useCallback, useRef, useState } from "react";
import { MatrixClientPeg } from "../client/peg";
import {
  ApprovalEventType,
  type ApprovalDecision,
  type ApprovalResponse,
  decodeApprovalRequest,
  findResolvingResponse,
} from "../events/approval";
import { useTimeline } from "./use-timeline";

export type ApprovalState = "pending" | "sending" | "resolved" | "error";

export interface UseApproval {
  state: ApprovalState;
  resolution: ApprovalResponse | null;
  error: string | null;
  send: (decision: ApprovalDecision, optionId?: string) => Promise<void>;
}

export function useApproval(requestEvent: MatrixEvent): UseApproval {
  const decoded = decodeApprovalRequest(requestEvent);
  const roomId = requestEvent.getRoomId() ?? "";
  const { events } = useTimeline(roomId);
  const resolution = decoded ? findResolvingResponse(events, decoded.approvalId) : null;

  const [sendingState, setSendingState] = useState<{ sending: boolean; error: string | null }>({
    sending: false,
    error: null,
  });
  const inFlight = useRef(false);

  const send = useCallback(
    async (decision: ApprovalDecision, optionId?: string) => {
      if (!decoded) return;
      if (resolution) return;
      if (inFlight.current) return;
      inFlight.current = true;
      setSendingState({ sending: true, error: null });
      try {
        const client = MatrixClientPeg.get();
        const content: Record<string, unknown> = {
          approval_id: decoded.approvalId,
          session_id: decoded.sessionId,
          decision,
        };
        if (optionId) content.option_id = optionId;
        // sendEvent's TimelineEvents type doesn't know about eco.zoon.* types;
        // the SDK accepts arbitrary event types at runtime.
        await (client.sendEvent as (
          roomId: string,
          type: string,
          content: Record<string, unknown>,
        ) => Promise<{ event_id: string }>)(roomId, ApprovalEventType.Response, content);
        // Stay back in "pending" awaiting the timeline echo, but keep
        // inFlight=true so a fast double-click can't fire a second send.
        // Only an error or the resolution event flips us out of this lock.
        setSendingState({ sending: false, error: null });
      } catch (e) {
        setSendingState({
          sending: false,
          error: e instanceof Error ? e.message : String(e),
        });
        inFlight.current = false;
      }
    },
    [decoded, resolution, roomId],
  );

  let state: ApprovalState = "pending";
  if (resolution) state = "resolved";
  else if (sendingState.error) state = "error";
  else if (sendingState.sending) state = "sending";

  return { state, resolution, error: sendingState.error, send };
}
