import { Button } from "@/components/ui/button";
import { useJoinRoom } from "@/hooks/use-join-room";

export function NotJoinedRoom({ roomId, search }: { roomId: string; search: string }) {
  const { joinRoom, joining, error } = useJoinRoom();
  return (
    <div className="flex h-full items-center justify-center p-6 sm:p-10">
      <div className="flex max-w-sm flex-col items-center text-center">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {error ? "You don't have access to this room" : "You're not in this room"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {error ? "Ask a member to invite you." : "Join it to open the linked thread."}
        </p>
        {!error && (
          <Button className="mt-6" disabled={joining} onClick={() => void joinRoom(roomId, { search })}>
            {joining ? "Joining…" : "Join room"}
          </Button>
        )}
      </div>
    </div>
  );
}
