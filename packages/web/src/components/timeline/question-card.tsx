import type { MatrixEvent } from "matrix-js-sdk";
import { useMemo } from "react";
import { ElicitationEventType } from "../../events/elicitation";
import { buildFormModel } from "../../lib/elicitation-form";
import { useElicitation } from "../../hooks/use-elicitation";
import { useMyPowerLevel } from "../../hooks/use-my-power-level";
import { useUserName } from "../../hooks/use-user-name";
import { QuestionCardView } from "./question-card-view";

export function QuestionCard({ event }: { event: MatrixEvent }) {
  const roomId = event.getRoomId() ?? "";
  const { decoded, state, resolution, rejection, error, send } = useElicitation(event);
  const power = useMyPowerLevel(roomId);
  const agentName = useUserName(decoded?.sender ?? "", roomId);
  const responder = useUserName(resolution?.respondedBy ?? "", roomId);
  const model = useMemo(
    () => (decoded ? buildFormModel(decoded.requestedSchema) : null),
    // The schema of a published request never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [decoded?.requestId],
  );
  if (!decoded || !model) return null;
  return (
    <QuestionCardView
      agentName={agentName}
      message={decoded.message}
      model={model}
      state={state}
      resolution={resolution ? { status: resolution.status, respondedBy: resolution.respondedBy ? responder : undefined } : undefined}
      answerValues={resolution?.content}
      fieldErrors={rejection?.reason === "invalid" ? rejection.errors : undefined}
      stale={rejection?.reason === "stale"}
      error={error ?? undefined}
      canAnswer={power.canSendEvent(ElicitationEventType.Response)}
      onSubmit={(content) => void send("accept", content)}
      onSkip={() => void send("decline")}
      onCancel={() => void send("cancel")}
    />
  );
}
