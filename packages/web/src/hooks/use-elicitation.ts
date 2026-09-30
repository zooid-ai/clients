import type { MatrixEvent } from "matrix-js-sdk";
import { useCallback, useRef, useState } from "react";
import { MatrixClientPeg } from "../client/peg";
import {
  ElicitationEventType,
  decodeElicitationRequest,
  findElicitationRejection,
  findElicitationResolution,
} from "../events/elicitation";
import { useElicitationTrail } from "./use-timeline";
import type { QuestionCardState } from "../components/timeline/question-card-view";

type Action = "accept" | "decline" | "cancel";

export function useElicitation(requestEvent: MatrixEvent) {
  const decoded = decodeElicitationRequest(requestEvent);
  const roomId = requestEvent.getRoomId() ?? "";
  const trail = useElicitationTrail(roomId, decoded?.requestId ?? "");
  const resolution = decoded ? findElicitationResolution(trail, decoded.requestId, decoded.sender, decoded) : null;
  const [mine, setMine] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const rejection =
    decoded && mine ? findElicitationRejection(trail, decoded.requestId, mine, decoded.sender, decoded) : null;

  const send = useCallback(
    async (action: Action, content?: Record<string, unknown>) => {
      if (!decoded || resolution || inFlight.current) return;
      inFlight.current = true;
      setSending(true);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          version: 1,
          request_id: decoded.requestId,
          request_event_id: decoded.requestEventId,
          action,
          ...(action === "accept" ? { content: content ?? {} } : {}),
          ...(decoded.threadRoot
            ? { "m.relates_to": { rel_type: "m.thread", event_id: decoded.threadRoot } }
            : {}),
        };
        const { event_id } = await (MatrixClientPeg.get().sendEvent as (
          roomId: string,
          type: string,
          content: Record<string, unknown>,
        ) => Promise<{ event_id: string }>)(roomId, ElicitationEventType.Response, body);
        setMine(event_id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSending(false);
        inFlight.current = false;
      }
    },
    [decoded, resolution, roomId],
  );

  // Never show a submission as accepted before the daemon confirms it.
  const state: QuestionCardState = resolution
    ? "resolved"
    : sending
      ? "sending"
      : mine && !rejection
        ? "awaiting_confirmation"
        : "open";

  return { decoded, state, resolution, rejection, error, send };
}
