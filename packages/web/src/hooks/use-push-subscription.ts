import { useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";
import { clientExt } from "@/client/client-ext";
import type { RuntimeConfig } from "@/client/runtime-config";
import { deviceLabel, pusherFromSubscription } from "@/lib/matrix/push-subscription";
import { ensureAgentPushRules } from "@/lib/matrix/notification-prefs";
import { primeAudio } from "@/lib/notification-sound";

const ZOOID_APP_ID = "dev.zooid.web";

export type PushConfig = Pick<RuntimeConfig, "push_gateway_url" | "vapid_public_key">;

export interface UsePushSubscription {
  /** False when push is unconfigured (no gateway/key) or the browser lacks the APIs. */
  supported: boolean;
  /** Whether a browser PushSubscription is currently registered — the in-page fallback notifier is inert while this is true. */
  subscribed: boolean;
  enable(): Promise<void>;
  disable(): Promise<void>;
}

function pushSupported(config: PushConfig): boolean {
  if (!config.push_gateway_url || !config.vapid_public_key) return false;
  if (typeof Notification === "undefined") return false;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  return true;
}

async function registerPusher(
  client: MatrixClient,
  sub: PushSubscription,
  config: { push_gateway_url: string },
): Promise<void> {
  await clientExt(client).setPusher(
    pusherFromSubscription(sub, {
      gatewayUrl: config.push_gateway_url,
      deviceDisplayName: deviceLabel(navigator.userAgent),
      lang: navigator.language,
    }),
  );
}

/**
 * Owns the browser PushSubscription ↔ Matrix pusher lifecycle. The Enable
 * button (settings) is the sole entry point to `enable()` — nothing here
 * ever prompts on its own; the mount effect only reconciles drift.
 */
export function usePushSubscription(config: PushConfig): UsePushSubscription {
  const supported = pushSupported(config);
  const gatewayUrl = config.push_gateway_url;
  const vapidKey = config.vapid_public_key;
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!supported || !gatewayUrl) return;
    let cancelled = false;
    void (async () => {
      const client = MatrixClientPeg.safeGet();
      if (!client) return;
      let reg: ServiceWorkerRegistration;
      try {
        reg = await navigator.serviceWorker.ready;
      } catch {
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (!sub || cancelled) return;
      setSubscribed(true);
      const p256dh = sub.toJSON().keys?.p256dh;
      const { pushers } = await clientExt(client).getPushers();
      const existing = pushers.find((p) => p.app_id === ZOOID_APP_ID && p.pushkey === p256dh);
      // Only re-register on drift (a stale gateway URL) — never blindly.
      if (existing && existing.data?.url === gatewayUrl) return;
      await registerPusher(client, sub, { push_gateway_url: gatewayUrl });
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, gatewayUrl, vapidKey]);

  const enable = async (): Promise<void> => {
    // FIRST, synchronously into the gesture. Safari drops user activation
    // across an await, so nothing may be awaited before this line. Permission
    // is requested even when push is unconfigured — the in-page fallback
    // notifier (useNotifications) needs it too.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    if (!supported || !gatewayUrl || !vapidKey) return;

    await primeAudio(); // same gesture — AudioContext starts suspended otherwise
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });
    const client = MatrixClientPeg.get();
    await registerPusher(client, sub, { push_gateway_url: gatewayUrl });
    await ensureAgentPushRules(client);
    setSubscribed(true);
  };

  const disable = async (): Promise<void> => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const p256dh = sub.toJSON().keys?.p256dh;
    const client = MatrixClientPeg.safeGet();
    if (client && p256dh) {
      // Remove the pusher BEFORE unsubscribing — the reverse order loses the
      // pushkey needed to identify which pusher to remove.
      await clientExt(client).removePusher(p256dh, ZOOID_APP_ID);
    }
    await sub.unsubscribe();
    setSubscribed(false);
  };

  return { supported, subscribed, enable, disable };
}
