import type { MatrixEvent } from "matrix-js-sdk";
import { Download, FileIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useMatrixClient } from "../../hooks/use-matrix-client";

interface MediaInfo {
  mimetype?: string;
  size?: number;
  w?: number;
  h?: number;
}

function humanSize(bytes: number | undefined): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseMxc(url: string): { serverName: string; mediaId: string } | null {
  const m = /^mxc:\/\/([^/]+)\/(.+)$/.exec(url);
  return m ? { serverName: m[1], mediaId: m[2] } : null;
}

function useAuthedMedia(
  mxcUrl: string,
  opts: { thumbnail?: { w: number; h: number } } = {},
): { blobUrl: string | null; loading: boolean } {
  const client = useMatrixClient();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const parsed = parseMxc(mxcUrl);
        if (!parsed) return;
        const baseUrl = (client as unknown as { baseUrl: string }).baseUrl;
        const token = (client as unknown as { getAccessToken: () => string }).getAccessToken();
        let url: string;
        if (opts.thumbnail) {
          url =
            `${baseUrl}/_matrix/client/v1/media/thumbnail/` +
            `${encodeURIComponent(parsed.serverName)}/${encodeURIComponent(parsed.mediaId)}` +
            `?width=${opts.thumbnail.w}&height=${opts.thumbnail.h}&method=scale`;
        } else {
          url =
            `${baseUrl}/_matrix/client/v1/media/download/` +
            `${encodeURIComponent(parsed.serverName)}/${encodeURIComponent(parsed.mediaId)}`;
        }
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error(`media fetch failed: ${r.status}`);
        const blob = await r.blob();
        if (!revoked) {
          objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      } catch (err) {
        console.warn("[media-message] fetch failed:", err);
      } finally {
        if (!revoked) setLoading(false);
      }
    })();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mxcUrl, client, opts.thumbnail?.w, opts.thumbnail?.h]);

  return { blobUrl, loading };
}

function DownloadButton({ mxcUrl, filename }: { mxcUrl: string; filename: string }) {
  const client = useMatrixClient();

  async function handleDownload() {
    const parsed = parseMxc(mxcUrl);
    if (!parsed) return;
    const baseUrl = (client as unknown as { baseUrl: string }).baseUrl;
    const token = (client as unknown as { getAccessToken: () => string }).getAccessToken();
    const url =
      `${baseUrl}/_matrix/client/v1/media/download/` +
      `${encodeURIComponent(parsed.serverName)}/${encodeURIComponent(parsed.mediaId)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <button
      type="button"
      aria-label="Download"
      onClick={() => void handleDownload()}
      className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}

function FileTile({
  mxcUrl,
  filename,
  info,
}: {
  mxcUrl: string;
  filename: string;
  info?: MediaInfo;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate font-medium">{filename}</span>
      {info?.size !== undefined && (
        <span className="shrink-0 text-xs text-muted-foreground">{humanSize(info.size)}</span>
      )}
      <DownloadButton mxcUrl={mxcUrl} filename={filename} />
    </div>
  );
}

function ImageTile({
  mxcUrl,
  filename,
  info,
}: {
  mxcUrl: string;
  filename: string;
  info?: MediaInfo;
}) {
  const { blobUrl } = useAuthedMedia(mxcUrl, { thumbnail: { w: 480, h: 360 } });

  return (
    <div className="flex flex-col gap-1">
      {blobUrl ? (
        <img
          src={blobUrl}
          alt={filename}
          className="max-h-80 rounded-md border border-border object-contain"
        />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-md border border-border bg-muted/40 text-xs text-muted-foreground">
          Loading…
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="truncate">{filename}</span>
        {info?.size !== undefined && <span>{humanSize(info.size)}</span>}
        <DownloadButton mxcUrl={mxcUrl} filename={filename} />
      </div>
    </div>
  );
}

export function MediaMessage({ event }: { event: MatrixEvent }) {
  const content = event.getContent() as {
    msgtype?: string;
    body?: string;
    filename?: string;
    url?: string;
    info?: MediaInfo;
  };

  const msgtype = content.msgtype ?? "";
  const filename = content.filename ?? content.body ?? "untitled";
  const mxcUrl = content.url ?? "";
  const info = content.info;

  if (msgtype === "m.image") {
    return <ImageTile mxcUrl={mxcUrl} filename={filename} info={info} />;
  }

  return <FileTile mxcUrl={mxcUrl} filename={filename} info={info} />;
}
