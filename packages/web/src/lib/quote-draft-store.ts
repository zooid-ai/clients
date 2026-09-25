import { useSyncExternalStore } from "react";
import type { QuoteRef } from "./matrix/quote";

/** A quote waiting in a composer. Keyed by room + thread (null = room composer). */
export interface QuoteDraft {
  quote: QuoteRef;
  senderName: string;
}

const drafts = new Map<string, QuoteDraft>();
const listeners = new Set<() => void>();
const keyOf = (roomId: string, threadId: string | null) => `${roomId}|${threadId ?? ""}`;

function emit() {
  for (const l of listeners) l();
}

export function setQuoteDraft(roomId: string, threadId: string | null, draft: QuoteDraft | null) {
  const k = keyOf(roomId, threadId);
  if (draft) drafts.set(k, draft);
  else drafts.delete(k);
  emit();
}

export function getQuoteDraft(roomId: string, threadId: string | null): QuoteDraft | null {
  return drafts.get(keyOf(roomId, threadId)) ?? null;
}

export function useQuoteDraft(roomId: string, threadId: string | null): QuoteDraft | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => getQuoteDraft(roomId, threadId),
    () => null,
  );
}

/** Tests only. */
export function resetQuoteDrafts() {
  drafts.clear();
  emit();
}
