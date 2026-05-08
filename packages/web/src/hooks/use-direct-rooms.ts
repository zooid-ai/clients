import { ClientEvent, type Room } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

const EMPTY: Room[] = [];

let cached: Room[] = EMPTY;

function snapshot(): Room[] {
  const client = MatrixClientPeg.safeGet();
  if (!client) {
    if (cached !== EMPTY) cached = EMPTY;
    return cached;
  }
  const ev = client.getAccountData("m.direct");
  if (!ev) {
    if (cached !== EMPTY) cached = EMPTY;
    return cached;
  }
  const content = ev.getContent() as Record<string, string[]>;
  const ids = new Set<string>();
  for (const arr of Object.values(content)) for (const id of arr ?? []) ids.add(id);
  const next = Array.from(ids)
    .map((id) => client.getRoom(id))
    .filter((r): r is Room => !!r);
  if (cached.length === next.length && cached.every((r, i) => r === next[i])) {
    return cached;
  }
  cached = next;
  return cached;
}

export function useDirectRooms(): Room[] {
  return useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      if (!client) return MatrixClientPeg.subscribe(cb);
      const onAccount = () => cb();
      client.on(ClientEvent.AccountData, onAccount);
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      return () => {
        client.off(ClientEvent.AccountData, onAccount);
        unsubPeg();
      };
    },
    snapshot,
    () => EMPTY,
  );
}
