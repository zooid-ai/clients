import { useEffect, useState } from "react";
import { FileIcon, X } from "lucide-react";
import { MAX_UPLOAD_BYTES } from "../../hooks/use-media-upload";

/** Matches the per-turn pending-media cap the daemon enforces (ZOD057). */
export const MAX_ATTACHMENTS = 8;

export interface StagedAttachment {
  /** Stable across re-renders so React keys and preview URLs don't churn. */
  id: string;
  file: File;
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `att-${seq}`;
}

function two(n: number): string {
  return String(n).padStart(2, "0");
}

/** Names the browser invents for a screenshot on the clipboard. */
const GENERIC_CLIPBOARD_NAME = /^(image|screenshot)?\.?(png|jpe?g|gif|webp|avif)?$/i;

/**
 * A screenshot pasted from the clipboard arrives named `image.png` — useless as
 * a timeline body, and every paste collides with the last one. Give those a
 * sortable name. A real file copied from the file manager keeps its own name.
 */
export function nameClipboardFile(file: File, now = new Date()): File {
  if (file.name && !GENERIC_CLIPBOARD_NAME.test(file.name)) return file;
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".png";
  const stamp =
    `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}` +
    `-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
  return new File([file], `pasted-${stamp}${ext}`, { type: file.type });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface StageResult {
  staged: StagedAttachment[];
  error: string | null;
}

/**
 * Applies the two staging rules — per-file size cap and the total cap — to a
 * batch of incoming files. Accepts what fits rather than rejecting the whole
 * batch, so dropping ten files still stages the first eight.
 */
export function stageFiles(current: StagedAttachment[], incoming: File[]): StageResult {
  const tooBig = incoming.filter((f) => f.size > MAX_UPLOAD_BYTES);
  const withinSize = incoming.filter((f) => f.size <= MAX_UPLOAD_BYTES);
  const room = Math.max(0, MAX_ATTACHMENTS - current.length);
  const accepted = withinSize.slice(0, room);
  const overflow = withinSize.length - accepted.length;

  // Each problem is a standalone sentence: the size one leads with a filename,
  // which must not be case-mangled to make a sentence out of the whole string.
  const problems: string[] = [];
  if (tooBig.length === 1) {
    problems.push(`\u201C${tooBig[0].name}\u201D is over the 0.5 MB limit.`);
  } else if (tooBig.length > 1) {
    problems.push(`${tooBig.length} files are over the 0.5 MB limit.`);
  }
  if (overflow > 0) {
    problems.push(`No more than ${MAX_ATTACHMENTS} attachments can be sent at once.`);
  }

  return {
    staged: [...current, ...accepted.map((file) => ({ id: nextId(), file }))],
    error: problems.length > 0 ? problems.join(" ") : null,
  };
}

/** Object URL for image files, revoked when the file leaves the tray. */
function useObjectUrl(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

interface ChipProps {
  attachment: StagedAttachment;
  progress?: number;
  onRemove: (id: string) => void;
}

function AttachmentChip({ attachment, progress, onRemove }: ChipProps) {
  const { id, file } = attachment;
  const previewUrl = useObjectUrl(file);
  const uploading = progress !== undefined && progress > 0 && progress < 1;

  return (
    <li className="relative flex w-48 shrink-0 items-center gap-2 overflow-hidden rounded-md border border-border bg-muted/50 p-1.5 text-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-background">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-xs" title={file.name}>
          {file.name}
        </span>
        <span className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
      </span>
      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        onClick={() => onRemove(id)}
        className="ml-auto shrink-0 self-start rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
      {uploading && (
        <span
          role="progressbar"
          aria-label={`Uploading ${file.name}`}
          aria-valuenow={Math.round(progress * 100)}
          className="absolute bottom-0 left-0 h-0.5 bg-primary transition-[width]"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      )}
    </li>
  );
}

export interface StagedAttachmentsProps {
  attachments: StagedAttachment[];
  /** Progress 0..1 for the attachment currently uploading, if any. */
  uploadingId?: string | null;
  progress?: number;
  onRemove: (id: string) => void;
}

export function StagedAttachments({
  attachments,
  uploadingId,
  progress,
  onRemove,
}: StagedAttachmentsProps) {
  if (attachments.length === 0) return null;
  return (
    <ul aria-label="Staged attachments" className="mb-2 flex gap-2 overflow-x-auto pb-1">
      {attachments.map((a) => (
        <AttachmentChip
          key={a.id}
          attachment={a}
          progress={a.id === uploadingId ? progress : undefined}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}
