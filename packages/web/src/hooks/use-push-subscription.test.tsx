import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import { makeFakeClient } from "../../test/factories";
import { usePushSubscription } from "./use-push-subscription";

const subscription = {
  endpoint: "https://fcm.example/abc",
  toJSON: () => ({ keys: { p256dh: "BPk_pub", auth: "authsecret" } }),
  unsubscribe: vi.fn().mockResolvedValue(true),
};

let subscribe: ReturnType<typeof vi.fn>;
let getSubscription: ReturnType<typeof vi.fn>;
let requestPermission: ReturnType<typeof vi.fn>;
let setPusher: ReturnType<typeof vi.fn>;

beforeEach(() => {
  subscribe = vi.fn().mockResolvedValue(subscription);
  getSubscription = vi.fn().mockResolvedValue(null);
  requestPermission = vi.fn().mockResolvedValue("granted");
  setPusher = vi.fn().mockResolvedValue({});

  (globalThis as Record<string, unknown>).Notification = Object.assign(function () {}, {
    permission: "default",
    requestPermission,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn().mockResolvedValue({}),
      ready: Promise.resolve({ pushManager: { subscribe, getSubscription } }),
      addEventListener: vi.fn(),
    },
  });

  const client = makeFakeClient({ userId: "@me:example.org" }) as unknown as Record<string, unknown>;
  client.setPusher = setPusher;
  client.getPushers = vi.fn().mockResolvedValue({ pushers: [] });
  client.removePusher = vi.fn().mockResolvedValue({});
  client.http = { authedRequest: vi.fn().mockResolvedValue({}) };
  client.getPushRules = vi.fn().mockResolvedValue({ global: { override: [] } });
  client.setPushRules = vi.fn();
  MatrixClientPeg.injectClientForTest(client as never);
});

afterEach(() => {
  MatrixClientPeg.reset();
  delete (globalThis as Record<string, unknown>).Notification;
});

const config = {
  push_gateway_url: "https://hs.example/_matrix/push/v1/notify",
  vapid_public_key: "BPk_server",
};

describe("usePushSubscription", () => {
  it("NEVER requests permission on mount — that is the bug this cycle fixes", async () => {
    renderHook(() => usePushSubscription(config));
    await waitFor(() => expect(getSubscription).toHaveBeenCalled());
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("requests permission, subscribes and registers the pusher on enable()", async () => {
    const { result } = renderHook(() => usePushSubscription(config));
    await act(async () => {
      await result.current.enable();
    });

    expect(requestPermission).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: "BPk_server",
    });
    expect(setPusher).toHaveBeenCalledWith(
      expect.objectContaining({ app_id: "dev.zooid.web", pushkey: "BPk_pub" }),
    );
  });

  it("calls requestPermission synchronously in the gesture — no await before it", async () => {
    // Safari drops the gesture across an await. requestPermission must be the
    // first thing enable() touches, before serviceWorker.ready is awaited.
    const order: string[] = [];
    requestPermission.mockImplementation(async () => {
      order.push("permission");
      return "granted";
    });
    subscribe.mockImplementation(async () => {
      order.push("subscribe");
      return subscription;
    });
    const { result } = renderHook(() => usePushSubscription(config));
    await act(async () => {
      await result.current.enable();
    });
    expect(order).toEqual(["permission", "subscribe"]);
  });

  it("installs the agent push rules as part of enabling", async () => {
    const { result } = renderHook(() => usePushSubscription(config));
    await act(async () => {
      await result.current.enable();
    });
    const client = MatrixClientPeg.get() as unknown as { http: { authedRequest: ReturnType<typeof vi.fn> } };
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      "PUT",
      "/pushrules/global/override/dev.zooid.approval_request",
      { before: ".m.rule.suppress_notices" },
      expect.anything(),
    );
  });

  it("stops at permission when the user denies, and registers no pusher", async () => {
    requestPermission.mockResolvedValue("denied");
    const { result } = renderHook(() => usePushSubscription(config));
    await act(async () => {
      await result.current.enable();
    });
    expect(subscribe).not.toHaveBeenCalled();
    expect(setPusher).not.toHaveBeenCalled();
  });

  it("skips subscription entirely when push is unconfigured", async () => {
    const { result } = renderHook(() => usePushSubscription({}));
    await act(async () => {
      await result.current.enable();
    });
    expect(subscribe).not.toHaveBeenCalled();
    expect(result.current.supported).toBe(false);
  });

  it("removes the pusher BEFORE unsubscribing — the reverse order loses the pushkey", async () => {
    getSubscription.mockResolvedValue(subscription);
    const order: string[] = [];
    const client = MatrixClientPeg.get() as unknown as Record<string, unknown>;
    (client.removePusher as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      order.push("removePusher");
    });
    subscription.unsubscribe.mockImplementation(async () => {
      order.push("unsubscribe");
      return true;
    });

    const { result } = renderHook(() => usePushSubscription(config));
    await act(async () => {
      await result.current.disable();
    });
    expect(order).toEqual(["removePusher", "unsubscribe"]);
  });

  it("repairs drift on startup instead of blindly re-registering", async () => {
    getSubscription.mockResolvedValue(subscription);
    const client = MatrixClientPeg.get() as unknown as Record<string, unknown>;
    (client.getPushers as ReturnType<typeof vi.fn>).mockResolvedValue({
      pushers: [{ app_id: "dev.zooid.web", pushkey: "BPk_pub", data: { url: config.push_gateway_url } }],
    });
    renderHook(() => usePushSubscription(config));
    await waitFor(() => expect(client.getPushers).toHaveBeenCalled());
    expect(setPusher).not.toHaveBeenCalled();
  });

  it("re-registers when the stored pusher points at a stale gateway", async () => {
    getSubscription.mockResolvedValue(subscription);
    const client = MatrixClientPeg.get() as unknown as Record<string, unknown>;
    (client.getPushers as ReturnType<typeof vi.fn>).mockResolvedValue({
      pushers: [{ app_id: "dev.zooid.web", pushkey: "BPk_pub", data: { url: "https://old.example/notify" } }],
    });
    renderHook(() => usePushSubscription(config));
    await waitFor(() => expect(setPusher).toHaveBeenCalled());
  });
});
