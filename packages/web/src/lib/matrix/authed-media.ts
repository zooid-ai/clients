import { useEffect, useState, useSyncExternalStore } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";

// Matrix 1.11 moved media behind authentication: the old unauthenticated
// /_matrix/media/v3/* endpoints are gone (Tuwunel answers them with
// "M_FORBIDDEN: Unauthenticated media is disabled"), and the replacement
// /_matrix/client/v1/media/* endpoints want an Authorization header — which an
// <img src> cannot send. So every media reference has to be fetched with the
// access token and handed to the DOM as an object URL.

export interface Thumbnail {
  width: number;
  height: number;
  /** Matrix thumbnail resize method. Avatars want "crop", inline images "scale". */
  method?: "crop" | "scale";
}

export function parseMxc(url: string): { serverName: string; mediaId: string } | null {
  const m = /^mxc:\/\/([^/]+)\/(.+)$/.exec(url);
  return m ? { serverName: m[1], mediaId: m[2] } : null;
}

function endpoints(client: MatrixClient, mxcUrl: string, thumbnail?: Thumbnail): [string, string] {
  const parsed = parseMxc(mxcUrl);
  if (!parsed) throw new Error(`not an mxc:// URL: ${mxcUrl}`);
  const base = client.baseUrl.replace(/\/+$/, "");
  const path = `${encodeURIComponent(parsed.serverName)}/${encodeURIComponent(parsed.mediaId)}`;
  if (thumbnail) {
    const q = `?width=${thumbnail.width}&height=${thumbnail.height}&method=${thumbnail.method ?? "scale"}`;
    return [
      `${base}/_matrix/client/v1/media/thumbnail/${path}${q}`,
      `${base}/_matrix/media/v3/thumbnail/${path}${q}`,
    ];
  }
  return [
    `${base}/_matrix/client/v1/media/download/${path}`,
    `${base}/_matrix/media/v3/download/${path}`,
  ];
}

async function errcodeOf(res: Response): Promise<string | null> {
  try {
    const body = (await res.clone().json()) as { errcode?: string };
    return body.errcode ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch media bytes with the client's access token, preferring the
 * authenticated endpoint and falling back to the legacy one only when the
 * homeserver doesn't recognise it (pre-1.11 servers).
 */
export async function fetchAuthedMedia(
  client: MatrixClient,
  mxcUrl: string,
  thumbnail?: Thumbnail,
): Promise<Blob> {
  const [authenticated, legacy] = endpoints(client, mxcUrl, thumbnail);
  const token = client.getAccessToken();
  const init: RequestInit = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  const res = await fetch(authenticated, init);
  if (res.ok) return await res.blob();

  // M_UNRECOGNIZED means "this homeserver has never heard of that endpoint",
  // i.e. it predates authenticated media. Every other status (403, a genuine
  // 404 for missing media, 5xx) is a real failure and must not be retried.
  if ((await errcodeOf(res)) !== "M_UNRECOGNIZED") {
    throw new Error(`media fetch failed: ${res.status}`);
  }

  const fallback = await fetch(legacy, init);
  if (!fallback.ok) throw new Error(`media fetch failed: ${fallback.status}`);
  return await fallback.blob();
}

// Object URLs are cached for the session and deliberately never revoked: the
// same avatar is rendered by the member list, the timeline and the room header,
// and a per-component blob would mean one HTTP request per mount.
const objectUrls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
const failedAt = new Map<string, number>();
const FAILURE_RETRY_MS = 60_000;

function cacheKey(client: MatrixClient, mxcUrl: string, thumbnail?: Thumbnail): string {
  const size = thumbnail
    ? `${thumbnail.width}x${thumbnail.height}:${thumbnail.method ?? "scale"}`
    : "full";
  return `${client.baseUrl}|${mxcUrl}|${size}`;
}

/** Resolve an mxc:// URL to a cached object URL, or null if it can't be fetched. */
export function loadAuthedMediaUrl(
  client: MatrixClient,
  mxcUrl: string,
  thumbnail?: Thumbnail,
): Promise<string | null> {
  const key = cacheKey(client, mxcUrl, thumbnail);
  const cached = objectUrls.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(key);
  if (pending) return pending;

  const failed = failedAt.get(key);
  if (failed !== undefined && Date.now() - failed < FAILURE_RETRY_MS) {
    return Promise.resolve(null);
  }

  const promise = fetchAuthedMedia(client, mxcUrl, thumbnail)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      objectUrls.set(key, url);
      failedAt.delete(key);
      return url;
    })
    .catch((err: unknown) => {
      console.warn(`[authed-media] ${mxcUrl}:`, err);
      failedAt.set(key, Date.now());
      return null;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** TEST ONLY. Drop cached object URLs and negative-cache entries. */
export function clearAuthedMediaCache(): void {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
  inflight.clear();
  failedAt.clear();
}

/**
 * Resolve an mxc:// URL to something an <img> can render. Returns null while
 * loading and when the media can't be fetched, so callers can hold a fallback.
 */
export function useAuthedMediaUrl(
  mxcUrl: string | null | undefined,
  thumbnail?: Thumbnail,
): string | null {
  const client = useSyncExternalStore(
    (cb) => MatrixClientPeg.subscribe(cb),
    () => MatrixClientPeg.safeGet(),
    () => null,
  );
  const width = thumbnail?.width;
  const height = thumbnail?.height;
  const method = thumbnail?.method;

  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !mxcUrl || !parseMxc(mxcUrl)) {
      setUrl(null);
      return;
    }
    const thumb = width !== undefined && height !== undefined ? { width, height, method } : undefined;
    // Synchronous hit on the session cache — avoids a fallback flash when the
    // same avatar has already been fetched by another component.
    const cached = objectUrls.get(cacheKey(client, mxcUrl, thumb));
    if (cached) {
      setUrl(cached);
      return;
    }
    let live = true;
    setUrl(null);
    void loadAuthedMediaUrl(client, mxcUrl, thumb).then((resolved) => {
      if (live) setUrl(resolved);
    });
    return () => {
      live = false;
    };
  }, [client, mxcUrl, width, height, method]);

  return url;
}
