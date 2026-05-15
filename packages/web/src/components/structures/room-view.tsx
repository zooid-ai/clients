import { useParams, useSearchParams } from "react-router-dom";
import { Composer } from "../rooms/composer";
import { TypingIndicator } from "../rooms/typing-indicator";
import { ThreadView } from "./thread-view";
import { TimelinePanel } from "./timeline-panel";
import { useMarkRead } from "../../hooks/use-mark-read";
import { useTyping } from "../../hooks/use-typing";

export function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const threadRootEventId = searchParams.get("thread");
  const typingUserIds = useTyping(roomId ?? "");
  useMarkRead(roomId ?? "");

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
      <Composer
        roomId={roomId}
        threadRootEventId={threadRootEventId}
        onExitThread={exitThread}
      />
    </article>
  );
}
