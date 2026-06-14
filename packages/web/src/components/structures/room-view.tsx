import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Composer } from "../rooms/composer";
import { TypingIndicator } from "../rooms/typing-indicator";
import { PlanBoard } from "../timeline/plan-board";
import { ThreadView } from "./thread-view";
import { TimelinePanel } from "./timeline-panel";
import { useMarkRead } from "../../hooks/use-mark-read";
import { useTyping } from "../../hooks/use-typing";
import { usePlan } from "../../hooks/use-plan";

export function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const threadRootEventId = searchParams.get("thread");
  const typingUserIds = useTyping(roomId ?? "");
  useMarkRead(roomId ?? "");

  const [planCollapsed, setPlanCollapsed] = useState(false);
  // Track which sessionId the user dismissed so a new plan in the same thread
  // re-shows the board automatically.
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null);

  // Reset collapse/dismiss state whenever the thread changes.
  useEffect(() => {
    setPlanCollapsed(false);
    setDismissedSessionId(null);
  }, [threadRootEventId]);

  const plan = usePlan(roomId ?? "", threadRootEventId ?? "");
  const showPlan =
    !!threadRootEventId && !!plan && plan.sessionId !== dismissedSessionId;

  function enterThread(id: string) {
    // Use replace=false so back button returns to the room timeline.
    setSearchParams({ thread: id });
  }
  function exitThread() {
    setSearchParams({});
  }

  if (!roomId) return <div>No room selected</div>;
  return (
    <article className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {threadRootEventId ? (
          <ThreadView
            roomId={roomId}
            rootEventId={threadRootEventId}
            onBack={exitThread}
          />
        ) : (
          <TimelinePanel
            roomId={roomId}
            onReplyInThread={enterThread}
            onViewThread={enterThread}
          />
        )}
      </div>
      <TypingIndicator typingUserIds={typingUserIds} roomId={roomId} />
      {showPlan && (
        <div className="px-3 pt-1">
          <PlanBoard
            plan={plan}
            collapsed={planCollapsed}
            onCollapse={() => setPlanCollapsed(true)}
            onExpand={() => setPlanCollapsed(false)}
            onDismiss={() => setDismissedSessionId(plan?.sessionId ?? null)}
          />
        </div>
      )}
      <Composer
        roomId={roomId}
        threadRootEventId={threadRootEventId}
        onExitThread={exitThread}
      />
    </article>
  );
}
