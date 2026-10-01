import type { MatrixEvent } from "matrix-js-sdk";
import { TriangleAlertIcon } from "lucide-react";
import { useMatrixClient } from "@/hooks/use-matrix-client";

/** Short, human reason a send was rejected, from the error the SDK kept on the echo. */
export function describeSendError(err: unknown): string {
  const e = err as { errcode?: string; message?: string; data?: { error?: string } } | null | undefined;
  const detail = e?.data?.error ?? e?.message ?? "";
  if (e?.errcode === "M_FORBIDDEN") {
    return /membership/i.test(detail)
      ? "You're not a member of this room yet"
      : "You don't have permission to send here";
  }
  if (e?.errcode) return e.errcode.replace(/^M_/, "").toLowerCase().replace(/_/g, " ");
  return detail || "Couldn't reach the server";
}

export function SendingIndicator() {
  return <span className="text-xs text-muted-foreground">Sending…</span>;
}

export function SendFailure({
  reason,
  onRetry,
  onDelete,
}: {
  reason: string;
  onRetry: () => void;
  onDelete: () => void;
}) {
  return (
    <div role="alert" className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-destructive">
      <TriangleAlertIcon className="size-3.5 shrink-0" />
      <span className="font-medium">Not sent</span>
      <span className="text-foreground/80">· {reason}</span>
      <span className="flex items-center gap-2 whitespace-nowrap">
        <button type="button" onClick={onRetry} className="font-medium text-foreground hover:underline">
          Retry
        </button>
        <button type="button" onClick={onDelete} className="text-foreground/70 hover:underline">
          Delete
        </button>
      </span>
    </div>
  );
}

/** Failure line for a local echo the server rejected; Retry reuses its txnId. */
export function EventSendFailure({ event }: { event: MatrixEvent }) {
  const client = useMatrixClient();
  const room = client?.getRoom(event.getRoomId() ?? "");
  return (
    <SendFailure
      reason={describeSendError(event.error)}
      onRetry={() => {
        if (client && room) void client.resendEvent(event, room).catch(() => {});
      }}
      onDelete={() => client?.cancelPendingEvent(event)}
    />
  );
}
