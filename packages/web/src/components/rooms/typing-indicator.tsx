import { senderColor } from "@/lib/sender";
import { useUserName } from "../../hooks/use-user-name";

interface Props {
  typingUserIds: string[];
  roomId?: string;
}

function TypingName({ userId, roomId }: { userId: string; roomId?: string }) {
  return (
    <span style={{ color: senderColor(userId) }}>{useUserName(userId, roomId)}</span>
  );
}

export function TypingIndicator({ typingUserIds, roomId }: Props) {
  if (typingUserIds.length === 0) return <div className="h-5" aria-hidden />;

  const MAX_NAMES = 2;
  const named = typingUserIds.slice(0, MAX_NAMES);
  const overflow = typingUserIds.length - MAX_NAMES;

  let suffix: string;
  if (overflow > 0) {
    suffix = ` and ${overflow} other${overflow > 1 ? "s" : ""} are typing…`;
  } else if (typingUserIds.length === 1) {
    suffix = " is typing…";
  } else {
    suffix = " are typing…";
  }

  const parts: React.ReactNode[] = [];
  named.forEach((uid, i) => {
    if (i > 0) parts.push(<span key={`sep-${i}`}>, </span>);
    parts.push(<TypingName key={uid} userId={uid} roomId={roomId} />);
  });

  return (
    <div className="h-5 px-3 text-xs text-muted-foreground flex items-center gap-0.5">
      {parts}
      <span>{suffix}</span>
    </div>
  );
}
