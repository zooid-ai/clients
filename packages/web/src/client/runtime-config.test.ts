import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { mswServer } from "../../test/setup";
import { isValidWorkforceSpace, loadRuntimeConfig } from "./runtime-config";

describe("loadRuntimeConfig", () => {
  it("parses a valid config.json", async () => {
    mswServer.use(
      http.get("/config.json", () =>
        HttpResponse.json({ homeserver_url: "https://h.example", default_idp_label: "Zoon" }),
      ),
    );
    const cfg = await loadRuntimeConfig();
    expect(cfg).toEqual({ homeserver_url: "https://h.example", default_idp_label: "Zoon" });
  });

  it("returns null when /config.json is missing (404)", async () => {
    mswServer.use(http.get("/config.json", () => HttpResponse.json({}, { status: 404 })));
    expect(await loadRuntimeConfig()).toBeNull();
  });

  it("returns null when /config.json is invalid JSON", async () => {
    mswServer.use(http.get("/config.json", () => HttpResponse.text("not json")));
    expect(await loadRuntimeConfig()).toBeNull();
  });

  it("rejects unknown fields silently (forward-compat)", async () => {
    mswServer.use(
      http.get("/config.json", () =>
        HttpResponse.json({ homeserver_url: "https://h.example", future_field: 42 }),
      ),
    );
    const cfg = await loadRuntimeConfig();
    expect(cfg?.homeserver_url).toBe("https://h.example");
  });

  it("parses the global_search opt-out flag", async () => {
    mswServer.use(
      http.get("/config.json", () => HttpResponse.json({ global_search: false })),
    );
    const cfg = await loadRuntimeConfig();
    expect(cfg).toEqual({ global_search: false });
  });

  it("ignores a non-boolean global_search", async () => {
    mswServer.use(
      http.get("/config.json", () => HttpResponse.json({ global_search: "yes" })),
    );
    const cfg = await loadRuntimeConfig();
    expect(cfg).toEqual({});
  });

  it("reads the two push fields", async () => {
    mswServer.use(
      http.get("/config.json", () =>
        HttpResponse.json({
          homeserver_url: "https://hs.example",
          push_gateway_url: "https://hs.example/_matrix/push/v1/notify",
          vapid_public_key: "BPk",
        }),
      ),
    );
    const cfg = await loadRuntimeConfig();
    expect(cfg).toEqual({
      homeserver_url: "https://hs.example",
      push_gateway_url: "https://hs.example/_matrix/push/v1/notify",
      vapid_public_key: "BPk",
    });
  });

  it("drops non-string push fields rather than passing junk to subscribe()", async () => {
    mswServer.use(
      http.get("/config.json", () => HttpResponse.json({ push_gateway_url: 42, vapid_public_key: null })),
    );
    expect(await loadRuntimeConfig()).toEqual({});
  });
});

describe("workforce_space", () => {
  it("passes a string value through", async () => {
    mswServer.use(http.get("/config.json", () => HttpResponse.json({ workforce_space: "acme" })));
    expect((await loadRuntimeConfig())?.workforce_space).toBe("acme");
  });

  it("leaves the key unset when omitted or not a string", async () => {
    mswServer.use(http.get("/config.json", () => HttpResponse.json({ workforce_space: 7 })));
    expect((await loadRuntimeConfig())?.workforce_space).toBeUndefined();
  });

  it.each(["acme", "team-a", "a.b_c"])("accepts %s as a localpart", (v) => {
    expect(isValidWorkforceSpace(v)).toBe(true);
  });

  it.each(["", "#acme", "acme:h.example", "#acme:h.example", "a b"])("rejects %j", (v) => {
    expect(isValidWorkforceSpace(v)).toBe(false);
  });
});
