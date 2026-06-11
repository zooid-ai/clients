import { UserAvatar } from "@/components/user-avatar";
import { useReadReceipts } from "@/hooks/use-read-receipts";

const MAX_FACES = 3;

export function ReadReceiptsRow({ roomId, eventId }: { roomId: string; eventId: string }) {
  const userIds = useReadReceipts(roomId, eventId);
  if (userIds.length === 0) return null;
  const shown = userIds.slice(0, MAX_FACES);
  const overflow = userIds.length - shown.length;
  return (
    <div
      className="mt-0.5 flex items-center justify-end gap-0.5"
      aria-label={`Seen by ${userIds.length}`}
    >
      {shown.map((userId) => (
        <UserAvatar key={userId} userId={userId} size="xs" />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}
