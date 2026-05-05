import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { mswServer } from "../../test/setup";
import { discoverHomeserver } from "./homeserver-discovery";

describe("discoverHomeserver — precedence", () => {
  it("uses .well-known when a full MXID is supplied", async () => {
    mswServer.use(
      http.get("https://example.com/.well-known/matrix/client", () =>
        HttpResponse.json({ "m.homeserver": { base_url: "https://matrix.example.com" } }),
      ),
    );
    const url = await discoverHomeserver({
      mxid: "@alice:example.com",
      runtimeConfig: null,
      buildtimeUrl: "https://buildtime.example",
    });
    expect(url).toBe("https://matrix.example.com");
  });

  it("falls through to runtime /config.json when no MXID is supplied", async () => {
    const url = await discoverHomeserver({
      mxid: null,
      runtimeConfig: { homeserver_url: "https://runtime.example" },
      buildtimeUrl: "https://buildtime.example",
    });
    expect(url).toBe("https://runtime.example");
  });

  it("falls through to build-time URL when nothing else is set", async () => {
    const url = await discoverHomeserver({
      mxid: null,
      runtimeConfig: null,
      buildtimeUrl: "https://buildtime.example",
    });
    expect(url).toBe("https://buildtime.example");
  });

  it("throws when nothing resolves", async () => {
    await expect(
      discoverHomeserver({ mxid: null, runtimeConfig: null, buildtimeUrl: null }),
    ).rejects.toThrow(/homeserver/i);
  });

  it("MXID well-known overrides runtime and build-time", async () => {
    mswServer.use(
      http.get("https://example.com/.well-known/matrix/client", () =>
        HttpResponse.json({ "m.homeserver": { base_url: "https://wellknown.example" } }),
      ),
    );
    const url = await discoverHomeserver({
      mxid: "@alice:example.com",
      runtimeConfig: { homeserver_url: "https://runtime.example" },
      buildtimeUrl: "https://buildtime.example",
    });
    expect(url).toBe("https://wellknown.example");
  });

  it("falls through past .well-known on 404 to runtime/build-time", async () => {
    mswServer.use(
      http.get("https://example.com/.well-known/matrix/client", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );
    const url = await discoverHomeserver({
      mxid: "@alice:example.com",
      runtimeConfig: { homeserver_url: "https://runtime.example" },
      buildtimeUrl: null,
    });
    expect(url).toBe("https://runtime.example");
  });
});
