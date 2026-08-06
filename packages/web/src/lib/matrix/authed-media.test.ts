import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import type { MatrixClient } from "matrix-js-sdk";
import { mswServer } from "../../../test/setup";
import {
  clearAuthedMediaCache,
  fetchAuthedMedia,
  loadAuthedMediaUrl,
  parseMxc,
} from "./authed-media";

const HS = "https://hs.test";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function fakeClient(): MatrixClient {
  return {
    baseUrl: HS,
    getAccessToken: () => "tok",
  } as unknown as MatrixClient;
}

function png() {
  return HttpResponse.arrayBuffer(PNG.buffer, { headers: { "Content-Type": "image/png" } });
}

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:media");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  clearAuthedMediaCache();
  vi.restoreAllMocks();
});

describe("parseMxc", () => {
  it("splits server name and media id", () => {
    expect(parseMxc("mxc://hs.test/abc")).toEqual({ serverName: "hs.test", mediaId: "abc" });
  });

  it("rejects non-mxc URLs", () => {
    expect(parseMxc("https://hs.test/abc")).toBeNull();
    expect(parseMxc("mxc://hs.test/")).toBeNull();
  });
});

describe("fetchAuthedMedia", () => {
  it("requests the authenticated thumbnail with a bearer token", async () => {
    let seen: { auth: string; query: string } | null = null;
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/thumbnail/hs.test/abc`, ({ request }) => {
        seen = {
          auth: request.headers.get("authorization") ?? "",
          query: new URL(request.url).search,
        };
        return png();
      }),
    );
    const blob = await fetchAuthedMedia(fakeClient(), "mxc://hs.test/abc", {
      width: 64,
      height: 64,
      method: "crop",
    });
    expect(blob.size).toBe(4);
    expect(seen).not.toBeNull();
    expect(seen!.auth).toBe("Bearer tok");
    expect(seen!.query).toBe("?width=64&height=64&method=crop");
  });

  it("requests the download endpoint when no thumbnail is asked for", async () => {
    let hit = false;
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/download/hs.test/abc`, () => {
        hit = true;
        return png();
      }),
    );
    await fetchAuthedMedia(fakeClient(), "mxc://hs.test/abc");
    expect(hit).toBe(true);
  });

  it("falls back to the legacy endpoint only when the server doesn't know the new one", async () => {
    let legacyHit = false;
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/download/hs.test/abc`, () =>
        HttpResponse.json({ errcode: "M_UNRECOGNIZED" }, { status: 404 }),
      ),
      http.get(`${HS}/_matrix/media/v3/download/hs.test/abc`, () => {
        legacyHit = true;
        return png();
      }),
    );
    await fetchAuthedMedia(fakeClient(), "mxc://hs.test/abc");
    expect(legacyHit).toBe(true);
  });

  it("does not retry the legacy endpoint on a real error", async () => {
    // A 403 from the authenticated endpoint means the media is forbidden, not
    // that the endpoint is missing — retrying the legacy path just burns a
    // request against a server that has unauthenticated media switched off.
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/download/hs.test/abc`, () =>
        HttpResponse.json({ errcode: "M_FORBIDDEN" }, { status: 403 }),
      ),
    );
    await expect(fetchAuthedMedia(fakeClient(), "mxc://hs.test/abc")).rejects.toThrow("403");
  });

  it("rejects a non-mxc URL without hitting the network", async () => {
    await expect(fetchAuthedMedia(fakeClient(), "https://evil.test/x")).rejects.toThrow("mxc://");
  });
});

describe("loadAuthedMediaUrl", () => {
  it("fetches once and serves the same object URL to later callers", async () => {
    let requests = 0;
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/thumbnail/hs.test/abc`, () => {
        requests += 1;
        return png();
      }),
    );
    const client = fakeClient();
    const thumb = { width: 64, height: 64, method: "crop" as const };
    const [a, b] = await Promise.all([
      loadAuthedMediaUrl(client, "mxc://hs.test/abc", thumb),
      loadAuthedMediaUrl(client, "mxc://hs.test/abc", thumb),
    ]);
    const c = await loadAuthedMediaUrl(client, "mxc://hs.test/abc", thumb);
    expect([a, b, c]).toEqual(["blob:media", "blob:media", "blob:media"]);
    expect(requests).toBe(1);
  });

  it("resolves null on failure and does not hammer the server", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let requests = 0;
    mswServer.use(
      http.get(`${HS}/_matrix/client/v1/media/thumbnail/hs.test/gone`, () => {
        requests += 1;
        return HttpResponse.json({ errcode: "M_NOT_FOUND" }, { status: 404 });
      }),
    );
    const client = fakeClient();
    const thumb = { width: 64, height: 64, method: "crop" as const };
    expect(await loadAuthedMediaUrl(client, "mxc://hs.test/gone", thumb)).toBeNull();
    expect(await loadAuthedMediaUrl(client, "mxc://hs.test/gone", thumb)).toBeNull();
    expect(requests).toBe(1);
  });
});
