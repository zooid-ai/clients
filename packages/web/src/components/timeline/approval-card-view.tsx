import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface ApprovalOptionView {
  optionId?: string;
  name: string;
  /** ACP option kind, e.g. "allow_once" / "reject_once". */
  kind: string;
}

export interface ApprovalResolutionView {
  decision: "allow" | "cancel";
  respondedBy: string;
}

export interface ApprovalCardViewProps {
  title: string;
  subtitle?: string;
  /** Pre-stringified tool input. When provided, a "Show details" toggle appears. */
  detail?: string;
  /** When present, the card renders in its resolved (decided) state. */
  resolution?: ApprovalResolutionView;
  error?: string;
  canApprove: boolean;
  options: ApprovalOptionView[];
  sending?: boolean;
  onRespond?: (decision: "allow" | "cancel", optionId?: string) => void;
}

/**
 * Pure presentation of an approval request. The Matrix-wired {@link ApprovalCard}
 * decodes the event, resolves power levels, and feeds this view. Kept free of
 * matrix-js-sdk so it can be rendered from Storybook and the marketing video
 * with synthetic data.
 */
export function ApprovalCardView({
  title,
  subtitle,
  detail,
  resolution,
  error,
  canApprove,
  options,
  sending,
  onRespond,
}: ApprovalCardViewProps) {
  const [open, setOpen] = useState(false);

  if (resolution) {
    return (
      <Card data-testid="approval-card" className="my-2 max-w-xl">
        <CardHeader>
          <CardTitle className="text-base break-words">{title}</CardTitle>
          <CardDescription>
            {subtitle && <span className="block">{subtitle}</span>}
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
        <CardTitle className="text-base break-words">{title}</CardTitle>
        {subtitle && (
          <CardDescription className="font-mono text-xs break-all">{subtitle}</CardDescription>
        )}
      </CardHeader>
      {detail !== undefined && (
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
              {detail}
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
          {options.length === 0 ? (
            <>
              <Button type="button" disabled={sending} onClick={() => onRespond?.("allow")}>
                Allow
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={sending}
                onClick={() => onRespond?.("cancel")}
              >
                Cancel
              </Button>
            </>
          ) : (
            options.map((opt) => {
              const isReject = opt.kind.startsWith("reject");
              const decision = isReject ? "cancel" : "allow";
              return (
                <Button
                  key={opt.optionId}
                  type="button"
                  variant={isReject ? "outline" : "default"}
                  disabled={sending}
                  onClick={() => onRespond?.(decision, opt.optionId)}
                  className="whitespace-normal break-words h-auto"
                >
                  {opt.name}
                </Button>
              );
            })
          )}
        </CardFooter>
      )}
    </Card>
  );
}
