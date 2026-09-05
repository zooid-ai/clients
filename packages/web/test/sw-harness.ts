import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

export interface SwClient {
  id: string;
  url: string;
  visibilityState: "visible" | "hidden";
  focused: boolean;
  focus: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
}

export function makeSwClient(over: Partial<SwClient> = {}): SwClient {
  return {
    id: "c1",
    url: "https://zooid.example/room/!other:example.org",
    visibilityState: "hidden",
    focused: false,
    focus: vi.fn(),
    postMessage: vi.fn(),
    ...over,
  };
}

export interface SwScope {
  handlers: Record<string, (event: unknown) => void>;
  showNotification: ReturnType<typeof vi.fn>;
  openWindow: ReturnType<typeof vi.fn>;
  setClients(clients: SwClient[]): void;
  dispatch(type: string, event: Record<string, unknown>): Promise<void>;
}

/**
 * Loads public/sw.js and evaluates it against a fake ServiceWorkerGlobalScope.
 * The worker deliberately imports no app code (spec §1), so there is no module
 * to import — evaluation is the only way to unit-test its branches.
 */
export function loadServiceWorker(): SwScope {
  const source = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8");
  const handlers: Record<string, (event: unknown) => void> = {};
  let clients: SwClient[] = [];
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);

  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      handlers[type] = fn;
    },
    registration: { showNotification },
    clients: {
      matchAll: vi.fn(async () => clients),
      openWindow,
    },
    skipWaiting: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function("self", "clients", source)(self, self.clients);

  return {
    handlers,
    showNotification,
    openWindow,
    setClients(next) {
      clients = next;
    },
    async dispatch(type, event) {
      let waited: Promise<unknown> = Promise.resolve();
      const ev = { ...event, waitUntil: (p: Promise<unknown>) => { waited = p; } };
      handlers[type]?.(ev);
      await waited;
    },
  };
}
