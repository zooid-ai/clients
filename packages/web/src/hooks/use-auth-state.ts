import { useSyncExternalStore } from "react";
import { MatrixClientPeg } from "../client/peg";

export type AuthState = "logged-in" | "logged-out";

export function useAuthState(): AuthState {
  return useSyncExternalStore(
    (cb) => MatrixClientPeg.subscribe(cb),
    () => (MatrixClientPeg.safeGet() ? "logged-in" : "logged-out"),
    () => "logged-out",
  );
}
