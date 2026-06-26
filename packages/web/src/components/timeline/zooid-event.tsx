import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  FileEdit,
  FileSearch,
  Globe,
  Loader2,
  Terminal,
  X,
} from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { DecodedZooidEvent } from "../../events/zooid-events";
import { useToolCallApproval, useToolCallStatus } from "@/hooks/use-timeline";
import { useUserName } from "@/hooks/use-user-name";
import { UserAvatar } from "@/components/user-avatar";
import { DiffView } from "./diff-view";

marked.use({ gfm: true, breaks: false });

function looksLikeMarkdown(text: string): boolean {
  return text.includes("```");
}

function renderToolOutput(text: string) {
  if (looksLikeMarkdown(text)) {
    const html = DOMPurify.sanitize(marked.parse(text) as string);
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none min-w-0 prose-pre:my-1 prose-pre:overflow-x-auto prose-pre:max-w-full prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border prose-code:bg-muted prose-code:text-foreground prose-code:rounded-sm prose-code:px-1 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <pre className="whitespace-pre-wrap break-words text-foreground/80">{text}</pre>
  );
}

interface Props {
  decoded: DecodedZooidEvent;
  sender: string;
  roomId: string;
  /** origin_server_ts of the underlying Matrix event (used for staleness detection). */
  ts: number;
}

export function ZooidEventTile({ decoded, sender, roomId, ts }: Props) {
  const senderName = useUserName(sender, roomId);
  switch (decoded.kind) {
    case "session.start":
      return <Divider text={`${senderName} started session`} />;

    case "turn.start":
      return null;

    case "turn.end":
      return <Divider text={`turn ended${decoded.stopReason ? ` (${decoded.stopReason})` : ""}`} />;

    case "agent_message_chunk":
      return (
        <div className="py-1 text-sm text-foreground/80">
          <span className="font-mono text-muted-foreground mr-2">{senderName}</span>
          {decoded.content}
        </div>
      );

    case "tool_call":
      return <ToolCallCard decoded={decoded} sender={sender} roomId={roomId} ts={ts} />;

    case "tool_call_update":
      // Folded into the parent tool_call card via useToolCallStatus.
      return null;

    case "plan":
      return (
        <div className="flex items-center gap-2 py-1.5">
          <div className="shrink-0">
            <UserAvatar userId={sender} size="sm" />
          </div>
          <span className="text-xs text-muted-foreground">{senderName} updated plan</span>
        </div>
      );
  }
}

function Divider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-xs uppercase tracking-wider text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      <span>{text}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function toolIcon(kind: string | undefined) {
  switch (kind) {
    case "edit":
      return FileEdit;
    case "read":
      return FileSearch;
    case "fetch":
      return Globe;
    case "execute":
      return Terminal;
    default:
      return Terminal;
  }
}

function StatusIndicator({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "completed") {
    return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === "failed") {
    return <X className="h-3.5 w-3.5 shrink-0 text-destructive" />;
  }
  if (status === "stalled") {
    return (
      <AlertTriangle
        className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
        aria-label="stalled"
      />
    );
  }
  if (status === "in_progress" || status === "pending") {
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />;
  }
  return null;
}

const STALL_THRESHOLD_MS = 5 * 60 * 1000;
const STALL_TICK_MS = 30 * 1000;

/**
 * Re-renders periodically while a tool call could still transition into
 * "stalled". Stops ticking once the call resolves or is already stale.
 */
function useStalenessTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), STALL_TICK_MS);
    return () => clearInterval(id);
  }, [active]);
}

function ToolCallCard({
  decoded,
  sender,
  roomId,
  ts,
}: {
  decoded: Extract<DecodedZooidEvent, { kind: "tool_call" }>;
  sender: string;
  roomId: string;
  ts: number;
}) {
  const [open, setOpen] = useState(false);
  const { status, content, diffs, rawInput: mergedRawInput, latestUpdateTs } = useToolCallStatus(
    roomId,
    decoded.toolCallId,
  );
  const approval = useToolCallApproval(roomId, decoded.toolCallId);
  const senderName = useUserName(sender, roomId);
  const Icon = toolIcon(decoded.toolKind);
  const title = decoded.title ?? decoded.toolKind ?? "Tool call";

  // Effective status: a tool that's been pending/in_progress (or has no update
  // at all) for longer than STALL_THRESHOLD_MS is presumed stalled.
  const isUnresolved =
    status === null || status === "pending" || status === "in_progress";
  useStalenessTick(isUnresolved);
  const lastActivityTs = Math.max(ts, latestUpdateTs);
  const stalled =
    isUnresolved && lastActivityTs > 0 && Date.now() - lastActivityTs > STALL_THRESHOLD_MS;
  const effectiveStatus = stalled
    ? "stalled"
    : status ?? (isUnresolved ? "in_progress" : null);
  // Prefer the rawInput merged across the initial tool_call and every
  // tool_call_update (later updates can omit fields the first event set, like
  // a webfetch url). Fall back to the matching approval_request's tool_input
  // when no rawInput came through on any event.
  const effectiveInput =
    (mergedRawInput && Object.keys(mergedRawInput).length > 0
      ? mergedRawInput
      : approval.toolInput) ?? undefined;
  const subtitle = summarizeRawInput(decoded.toolKind, effectiveInput, decoded.locations);
  return (
    <div className="my-1 rounded-md border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-muted/50"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">{title}</span>
        {subtitle && (
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{subtitle}</span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <StatusIndicator status={effectiveStatus} />
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          />
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-2.5 py-2 text-xs text-muted-foreground space-y-1">
          {stalled && (
            <div className="rounded-sm bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-400">
              No updates for over 5 minutes — the tool may be stuck. Try
              <code className="font-mono"> /interrupt</code> to cancel.
            </div>
          )}
          <div>
            <span className="text-foreground/70">by</span> {senderName}
          </div>
          <div className="font-mono break-all">id: {decoded.toolCallId}</div>
          {decoded.locations && decoded.locations.length > 0 && (
            <div>
              <span className="text-foreground/70">files: </span>
              {decoded.locations.map((l, i) => (
                <span key={i} className="font-mono break-all">
                  {l.path}
                  {l.line !== undefined ? `:${l.line}` : ""}
                  {i < decoded.locations!.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          )}
          {effectiveInput && Object.keys(effectiveInput).length > 0 &&
            (() => {
              const rawDiff = extractRawInputDiff(effectiveInput);
              if (rawDiff) {
                return (
                  <div className="space-y-1">
                    <DiffView diff={rawDiff} />
                  </div>
                );
              }
              return (
                <pre className="mt-1 max-h-64 max-w-full overflow-auto rounded-md border border-border bg-muted p-2 text-xs text-foreground">
                  {safeStringify(effectiveInput)}
                </pre>
              );
            })()
          }
          {diffs.length > 0 && (
            <div className="space-y-1">
              {diffs.map((d, i) => (
                <DiffView key={i} diff={d} />
              ))}
            </div>
          )}
          {content && (
            <div className="mt-1">
              <span className="text-foreground/70 block mb-0.5">output:</span>
              {renderToolOutput(content)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function shortPath(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

function resolveFilePath(input: Record<string, unknown>): string | null {
  if (typeof input.file_path === "string") return input.file_path;
  if (typeof input.filepath === "string") return input.filepath;
  return null;
}

function extractRawInputDiff(input: Record<string, unknown>): import("../../events/zooid-events").DiffBlock | null {
  if (typeof input.new_string !== "string") return null;
  const path = resolveFilePath(input) ?? "edit";
  return {
    path,
    oldText: typeof input.old_string === "string" ? input.old_string : "",
    newText: input.new_string,
  };
}

function summarizeRawInput(
  kind: string | undefined,
  input: Record<string, unknown> | undefined,
  locations: Array<{ path: string }> | undefined,
): string | null {
  if (input) {
    const fp = resolveFilePath(input);
    if ((kind === "edit" || kind === "read") && fp) return shortPath(fp);
    if (kind === "fetch" && typeof input.url === "string") return input.url;
    if (kind === "execute" && typeof input.command === "string") return input.command;
    // Generic fallback: first short string field that isn't a patch blob.
    for (const [k, v] of Object.entries(input)) {
      if (k === "diff" || k === "old_string" || k === "new_string") continue;
      if (typeof v === "string" && v.length < 120) return v;
    }
  }
  if (locations && locations.length > 0) return shortPath(locations[0].path);
  return null;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

