import type { WebPushPusher } from "../../client/client-ext";

const ZOOID_APP_ID = "dev.zooid.web";
const APP_DISPLAY_NAME = "Zooid Web";

export interface PusherOpts {
  gatewayUrl: string;
  deviceDisplayName: string;
  lang: string;
}

/**
 * Reassemble a browser PushSubscription into a Matrix pusher. `p256dh`
 * becomes `pushkey` — it's the value the homeserver hands the gateway per
 * device, and the gateway reassembles the subscription's `endpoint` +
 * `auth` + this `pushkey` back into the shape `web-push` needs.
 */
export function pusherFromSubscription(sub: PushSubscription, opts: PusherOpts): WebPushPusher {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) {
    throw new Error("push subscription has no keys — cannot register a pusher that can never be encrypted to");
  }
  return {
    kind: "http",
    app_id: ZOOID_APP_ID,
    pushkey: p256dh,
    app_display_name: APP_DISPLAY_NAME,
    device_display_name: opts.deviceDisplayName,
    lang: opts.lang,
    // Re-registering the same device must replace its pusher, not add a
    // second one the homeserver would try to deliver to twice.
    append: false,
    data: {
      url: opts.gatewayUrl,
      endpoint: sub.endpoint,
      auth,
      events_only: true,
      default_payload: {},
    },
  };
}

function detectBrowser(ua: string): string | null {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return null;
}

function detectPlatform(ua: string): string | null {
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

/** A human device label for the pusher list — never empty. */
export function deviceLabel(userAgent: string): string {
  const browser = detectBrowser(userAgent);
  const platform = detectPlatform(userAgent);
  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  return "Zooid Web";
}
