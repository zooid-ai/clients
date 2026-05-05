import { type KeyboardEvent, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useMatrixClient } from "../../hooks/use-matrix-client";

export function Composer({ roomId }: { roomId: string }) {
  const client = useMatrixClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const body = value.trim();
    if (!body) return;
    setError(null);
    try {
      await (client.sendEvent as (
        roomId: string,
        type: string,
        content: Record<string, unknown>,
      ) => Promise<{ event_id: string }>)(roomId, "m.room.message", { msgtype: "m.text", body });
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border p-3">
      {error && (
        <div role="alert" className="text-destructive text-sm">
          {error}
        </div>
      )}
      <Textarea
        aria-label="Message"
        placeholder="Send a message…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        className="resize-none"
      />
    </div>
  );
}
