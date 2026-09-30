import { senderColor } from "@/lib/sender";
import { useUserName } from "../../hooks/use-user-name";

interface Props {
  typingUserIds: string[];
  awaitingUserIds?: string[];
  roomId?: string;
}

function TypingName({ userId, roomId }: { userId: string; roomId?: string }) {
  return (
    <span style={{ color: senderColor(userId) }}>{useUserName(userId, roomId)}</span>
  );
}

export function TypingIndicator({ typingUserIds: allTyping, awaitingUserIds = [], roomId }: Props) {
  const typingUserIds = allTyping.filter((id) => !awaitingUserIds.includes(id));
  if (typingUserIds.length === 0 && awaitingUserIds.length === 0) return <div className="h-5" aria-hidden />;

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
    if (i > 0) parts.push(", ");
    parts.push(<TypingName key={uid} userId={uid} roomId={roomId} />);
  });

  return (
    <div className="h-5 px-3 text-xs text-muted-foreground leading-5">
      {awaitingUserIds.length > 0 && <span className="text-amber-600 dark:text-amber-400">
        {awaitingUserIds.map((id, index) => <span key={id}>{index > 0 ? ", " : ""}<TypingName userId={id} roomId={roomId} /></span>)}
        {awaitingUserIds.length === 1 ? " is awaiting your input" : " are awaiting your input"}
      </span>}
      {awaitingUserIds.length > 0 && typingUserIds.length > 0 && " · "}
      {typingUserIds.length > 0 && <span>{parts}{suffix}</span>}
    </div>
  );
}
