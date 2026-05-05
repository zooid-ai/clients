import type { MatrixClient } from "matrix-js-sdk";
import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

// Hard invariant: only this hook (and the peg itself) touches the MatrixClient.
// Components must NOT import MatrixClient directly.
export function useMatrixClient(): MatrixClient {
  const client = useSyncExternalStore(
    (cb) => MatrixClientPeg.subscribe(cb),
    () => MatrixClientPeg.safeGet(),
    () => null,
  );
  if (!client) throw new Error("useMatrixClient called when not logged in");
  return client;
}
