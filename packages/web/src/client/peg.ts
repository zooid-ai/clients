import { type MatrixClient, MemoryStore, createClient } from "matrix-js-sdk";
import { sessionStorage_ } from "./storage";
import type { Credentials } from "./login";

type Listener = () => void;

class MatrixClientPegImpl {
  private client: MatrixClient | null = null;
  private listeners = new Set<Listener>();

  safeGet(): MatrixClient | null {
    return this.client;
  }

  get(): MatrixClient {
    if (!this.client) throw new Error("MatrixClientPeg: not logged in");
    return this.client;
  }

  set(creds: Credentials): MatrixClient {
    if (this.client) this.client.stopClient();
    this.client = createClient({
      baseUrl: creds.homeserverUrl,
      accessToken: creds.accessToken,
      userId: creds.userId,
      deviceId: creds.deviceId,
      // Pin the store explicitly. The SDK's default tries IndexedDB which
      // jsdom doesn't have, and silent fallback hides bugs. MemoryStore is
      // also what we want in dev — persistent sync state lands in PLAN-02
      // alongside an IndexedDB-backed store.
      store: new MemoryStore({ localStorage: globalThis.localStorage }),
    });
    sessionStorage_.setJSON("session", creds);
    this.emit();
    return this.client;
  }

  reset(): void {
    if (this.client) {
      try {
        this.client.stopClient();
      } catch {
        // tolerated — stopClient is best-effort during teardown
      }
    }
    this.client = null;
    sessionStorage_.remove("session");
    this.emit();
  }

  /** TEST ONLY. Inject a pre-built client without going through createClient(). */
  injectClientForTest(client: MatrixClient): void {
    if (this.client) {
      try {
        this.client.stopClient();
      } catch {
        // tolerated
      }
    }
    this.client = client;
    this.emit();
  }

  restoreFromStorage(): Credentials | null {
    const creds = sessionStorage_.getJSON<Credentials>("session");
    if (!creds) return null;
    this.set(creds);
    return creds;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

export const MatrixClientPeg = new MatrixClientPegImpl();
