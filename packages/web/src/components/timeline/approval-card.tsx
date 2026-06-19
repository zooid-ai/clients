import type { MatrixEvent } from "matrix-js-sdk";
import { ApprovalEventType, decodeApprovalRequest } from "../../events/approval";
import { useApproval } from "../../hooks/use-approval";
import { useMyPowerLevel } from "../../hooks/use-my-power-level";
import { ApprovalCardView } from "./approval-card-view";

export function ApprovalCard({ event }: { event: MatrixEvent }) {
  const decoded = decodeApprovalRequest(event);
  const roomId = event.getRoomId() ?? "";
  const power = useMyPowerLevel(roomId);
  const { state, resolution, error, send } = useApproval(event);

  if (!decoded) return null;
  const canApprove = power.canSendEvent(ApprovalEventType.Response);
  const summary = summarizeTool(decoded.toolKind, decoded.toolTitle, decoded.toolInput);

  return (
    <ApprovalCardView
      title={summary.title}
      subtitle={summary.subtitle}
      detail={decoded.toolInput !== undefined ? safeStringify(decoded.toolInput) : undefined}
      resolution={state === "resolved" && resolution ? resolution : undefined}
      error={error ?? undefined}
      canApprove={canApprove}
      options={decoded.options}
      sending={state === "sending"}
      onRespond={send}
    />
  );
}

interface ToolSummary {
  title: string;
  subtitle?: string;
}

function summarizeTool(
  kind: string | undefined,
  title: string | undefined,
  input: unknown,
): ToolSummary {
  const label = title ?? kind ?? "Tool call";
  const obj = (input && typeof input === "object" ? (input as Record<string, unknown>) : null);
  if (kind === "edit" && obj && typeof obj.filepath === "string") {
    return { title: `Edit ${shortPath(obj.filepath)}`, subtitle: obj.filepath };
  }
  if (kind === "fetch" && obj && typeof obj.url === "string") {
    return { title: `Fetch`, subtitle: obj.url };
  }
  if (kind === "execute" && obj && typeof obj.command === "string") {
    return { title: `Run command`, subtitle: obj.command };
  }
  if (kind === "read" && obj && typeof obj.filepath === "string") {
    return { title: `Read ${shortPath(obj.filepath)}`, subtitle: obj.filepath };
  }
  // Generic fallback: prefer a short string field if one looks meaningful.
  if (obj) {
    const firstStr = Object.entries(obj).find(
      ([k, v]) => typeof v === "string" && k !== "diff" && (v as string).length < 200,
    );
    if (firstStr) return { title: label, subtitle: String(firstStr[1]) };
  }
  return { title: label };
}

function shortPath(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
