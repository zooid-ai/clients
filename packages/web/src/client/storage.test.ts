import { afterEach, describe, expect, it } from "vitest";
import { LocalStorageAdapter, type StorageAdapter } from "./storage";

describe("StorageAdapter", () => {
  afterEach(() => localStorage.clear());

  it("LocalStorageAdapter round-trips strings", () => {
    const s: StorageAdapter = new LocalStorageAdapter("zoon");
    s.set("token", "abc");
    expect(s.get("token")).toBe("abc");
    s.remove("token");
    expect(s.get("token")).toBeNull();
  });

  it("LocalStorageAdapter namespaces keys", () => {
    const s = new LocalStorageAdapter("zoon");
    s.set("token", "abc");
    // Verify the actual storage key is namespaced; this is the seam guarantee
    // future adapters (encrypted IndexedDB) must also honor.
    expect(localStorage.getItem("zoon:token")).toBe("abc");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("getJSON parses JSON values", () => {
    const s = new LocalStorageAdapter("zoon");
    s.setJSON("session", { userId: "@a:b.c", accessToken: "x", deviceId: "d" });
    expect(s.getJSON<{ userId: string }>("session")?.userId).toBe("@a:b.c");
  });

  it("getJSON returns null for missing keys", () => {
    const s = new LocalStorageAdapter("zoon");
    expect(s.getJSON("missing")).toBeNull();
  });
});
