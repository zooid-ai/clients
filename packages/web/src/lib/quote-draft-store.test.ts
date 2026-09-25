import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { QuoteRef } from "./matrix/quote";
import { getQuoteDraft, resetQuoteDrafts, setQuoteDraft, useQuoteDraft } from "./quote-draft-store";

const q = (event_id: string): QuoteRef => ({
  room_id: "!r:h.example",
  event_id,
  thread_id: event_id,
  sender: "@a:h.example",
  origin_server_ts: 0,
  snapshot: { msgtype: "m.text", body: event_id },
});

afterEach(() => resetQuoteDrafts());

describe("quote draft store", () => {
  it("keeps one draft per room and thread", () => {
    setQuoteDraft("!r", null, { quote: q("$a"), senderName: "A" });
    setQuoteDraft("!r", "$t", { quote: q("$b"), senderName: "B" });
    expect(getQuoteDraft("!r", null)?.quote.event_id).toBe("$a");
    expect(getQuoteDraft("!r", "$t")?.quote.event_id).toBe("$b");
    expect(getQuoteDraft("!other", null)).toBeNull();
  });

  it("replaces and clears", () => {
    setQuoteDraft("!r", null, { quote: q("$a"), senderName: "A" });
    setQuoteDraft("!r", null, { quote: q("$c"), senderName: "C" });
    expect(getQuoteDraft("!r", null)?.quote.event_id).toBe("$c");
    setQuoteDraft("!r", null, null);
    expect(getQuoteDraft("!r", null)).toBeNull();
  });

  it("notifies subscribed hooks", () => {
    const { result } = renderHook(() => useQuoteDraft("!r", null));
    expect(result.current).toBeNull();
    act(() => setQuoteDraft("!r", null, { quote: q("$a"), senderName: "A" }));
    expect(result.current?.quote.event_id).toBe("$a");
  });
});
