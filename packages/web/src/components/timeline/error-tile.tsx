import { TriangleAlertIcon } from "lucide-react";
import type { DecodedEcoZoonEvent } from "../../events/eco-zoon";

type ErrorDecoded = Extract<DecodedEcoZoonEvent, { kind: "error" }>;

export function ErrorTile({ decoded }: { decoded: ErrorDecoded }) {
  const handleCopy = () => {
    const payload: Record<string, unknown> = {
      code: decoded.code,
      message: decoded.message,
    };
    if (decoded.detail) payload.detail = decoded.detail;
    if (decoded.acpError) payload.acp_error = decoded.acpError;
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  return (
    <div className="my-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
      <div className="flex items-start gap-2">
        <TriangleAlertIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="font-medium">{decoded.message}</div>
          {decoded.detail && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                details
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs">
                {decoded.detail}
              </pre>
            </details>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 hover:bg-accent"
              onClick={handleCopy}
            >
              Copy details
            </button>
            {decoded.recovery && (
              <a
                href={decoded.recovery}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-border px-2 py-0.5 hover:bg-accent"
              >
                Learn more
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
