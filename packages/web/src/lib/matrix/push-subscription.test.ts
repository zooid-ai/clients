import { describe, expect, it } from "vitest";
import { pusherFromSubscription, deviceLabel } from "./push-subscription";

const sub = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  toJSON: () => ({ keys: { p256dh: "BPk_public", auth: "authsecret" } }),
} as unknown as PushSubscription;

describe("pusherFromSubscription", () => {
  it("maps p256dh to pushkey and the rest into data", () => {
    const p = pusherFromSubscription(sub, {
      gatewayUrl: "https://zooid.zoon.eco/_matrix/push/v1/notify",
      deviceDisplayName: "Chrome on macOS",
      lang: "en-GB",
    });
    expect(p).toEqual({
      kind: "http",
      app_id: "dev.zooid.web",
      pushkey: "BPk_public",
      app_display_name: "Zooid Web",
      device_display_name: "Chrome on macOS",
      lang: "en-GB",
      append: false,
      data: {
        url: "https://zooid.zoon.eco/_matrix/push/v1/notify",
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        auth: "authsecret",
        events_only: true,
        default_payload: {},
      },
    });
  });

  it("append:false so re-registering the same device replaces rather than duplicates", () => {
    expect(pusherFromSubscription(sub, { gatewayUrl: "u", deviceDisplayName: "d", lang: "en" }).append).toBe(
      false,
    );
  });

  it("throws on a subscription with no keys rather than registering a pusher that can never be encrypted to", () => {
    const broken = { endpoint: "https://x", toJSON: () => ({}) } as unknown as PushSubscription;
    expect(() =>
      pusherFromSubscription(broken, { gatewayUrl: "u", deviceDisplayName: "d", lang: "en" }),
    ).toThrow();
  });
});

describe("deviceLabel", () => {
  it("names the browser and platform", () => {
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0")).toBe(
      "Chrome on macOS",
    );
  });
  it("falls back rather than producing an empty label", () => {
    expect(deviceLabel("")).toBe("Zooid Web");
  });
});
