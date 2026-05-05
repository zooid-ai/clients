import { useEffect } from "react";
import { useMatrixClient } from "../../hooks/use-matrix-client";
import { MatrixClientPeg } from "../../client/peg";

export function LoggedInView() {
  const client = useMatrixClient();

  useEffect(() => {
    // Spec: minimal startClient. Sync, room list, and timeline are PLAN-02.
    client.startClient({ initialSyncLimit: 10 }).catch(() => {
      // Sync failures are surfaced in PLAN-02; for now we just keep the shell up.
    });
    return () => {
      // We don't stop on unmount — the peg owns lifecycle. Logout calls reset().
    };
  }, [client]);

  return (
    <div data-testid="logged-in-view">
      <header>
        <span>{client.getUserId()}</span>
        <button type="button" onClick={() => MatrixClientPeg.reset()}>
          Log out
        </button>
      </header>
      <main>{/* PLAN-02 fills LeftPanel + RoomView here */}</main>
    </div>
  );
}
