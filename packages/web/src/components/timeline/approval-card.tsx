import { useState } from "react";
import type { MatrixEvent } from "matrix-js-sdk";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApprovalEventType, decodeApprovalRequest } from "../../events/approval";
import { useApproval } from "../../hooks/use-approval";
import { useMyPowerLevel } from "../../hooks/use-my-power-level";

export function ApprovalCard({ event }: { event: MatrixEvent }) {
  const decoded = decodeApprovalRequest(event);
  const roomId = event.getRoomId() ?? "";
  const power = useMyPowerLevel(roomId);
  const { state, resolution, error, send } = useApproval(event);
  const [open, setOpen] = useState(false);

  if (!decoded) return null;
  const canApprove = power.canSendEvent(ApprovalEventType.Response);

  const summary = summarizeTool(decoded.toolKind, decoded.toolTitle, decoded.toolInput);

  if (state === "resolved" && resolution) {
    return (
      <Card data-testid="approval-card" className="my-2 max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">{summary.title}</CardTitle>
          <CardDescription>
            {summary.subtitle && <span className="block">{summary.subtitle}</span>}
            {resolution.decision === "allow" ? "Approved" : "Cancelled"} by{" "}
            <span>{resolution.respondedBy}</span>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card data-testid="approval-card" className="my-2 max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">{summary.title}</CardTitle>
        {summary.subtitle && (
          <CardDescription className="font-mono text-xs break-all">
            {summary.subtitle}
          </CardDescription>
        )}
      </CardHeader>
      {decoded.toolInput !== undefined && (
        <CardContent className="pt-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={open}
          >
            {open ? "Hide details ▾" : "Show details ▸"}
          </button>
          {open && (
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-xs">
              {safeStringify(decoded.toolInput)}
            </pre>
          )}
        </CardContent>
      )}
      {error && (
        <CardContent>
          <div role="alert" className="text-destructive text-sm">
            {error}
          </div>
        </CardContent>
      )}
      {!canApprove ? (
        <CardContent>
          <p className="text-muted-foreground text-sm">
            You have insufficient permission to respond to this approval.
          </p>
        </CardContent>
      ) : (
        <CardFooter className="gap-2">
          {(() => {
            // Prefer agent-supplied options (one button each). When the
            // agent didn't supply any, fall back to a generic Allow/Cancel
            // pair with no optionId — older zooid daemons did this.
            if (decoded.options.length === 0) {
              return (
                <>
                  <Button
                    type="button"
                    disabled={state === "sending"}
                    onClick={() => send("allow")}
                  >
                    Allow
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={state === "sending"}
                    onClick={() => send("cancel")}
                  >
                    Cancel
                  </Button>
                </>
              );
            }
            return decoded.options.map((opt) => {
              const isReject = opt.kind.startsWith("reject");
              const decision = isReject ? "cancel" : "allow";
              return (
                <Button
                  key={opt.optionId}
                  type="button"
                  variant={isReject ? "outline" : "default"}
                  disabled={state === "sending"}
                  onClick={() => send(decision, opt.optionId)}
                >
                  {opt.name}
                </Button>
              );
            });
          })()}
        </CardFooter>
      )}
    </Card>
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
