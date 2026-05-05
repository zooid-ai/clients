import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { MatrixClientPeg } from "../../client/peg";
import { useMatrixClient } from "../../hooks/use-matrix-client";
import { LeftPanel } from "./left-panel";
import { MainSplit } from "./main-split";

export function LoggedInView() {
  const client = useMatrixClient();

  useEffect(() => {
    client.startClient({ initialSyncLimit: 10 }).catch(() => {
      // sync errors are out of scope for this cycle; surface in future epic
    });
  }, [client]);

  return (
    <div data-testid="logged-in-view">
      <header>
        <span>{client.getUserId()}</span>
        <button type="button" onClick={() => MatrixClientPeg.reset()}>
          Log out
        </button>
      </header>
      <MainSplit left={<LeftPanel />} main={<Outlet />} />
    </div>
  );
}
