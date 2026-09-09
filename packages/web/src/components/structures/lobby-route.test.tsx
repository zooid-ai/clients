import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { makeFakeClient, makeRoom } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import type { LoggedInOutletContext } from "./logged-in-view";
import { LobbyRoute } from "./lobby";

const me = "@me:h.example";
afterEach(() => MatrixClientPeg.reset());

function renderWithContext(ctx: Partial<LoggedInOutletContext>) {
  const full: LoggedInOutletContext = {
    spaceId: null,
    activeScope: { kind: "home" },
    setScope: () => {},
    ...ctx,
  };
  render(
    <SidebarProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Outlet context={full} />}>
            <Route index element={<LobbyRoute />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SidebarProvider>,
  );
}

it("renders the Pick-a-room fallback when no space is active", () => {
  const client = makeFakeClient({ userId: me });
  MatrixClientPeg.injectClientForTest(client);
  renderWithContext({ spaceId: null, activeScope: { kind: "home" } });
  expect(screen.getByText(/pick a room to get started/i)).toBeInTheDocument();
});

it("renders the Lobby when a space is active", () => {
  const spaceId = "!space:h.example";
  const client = makeFakeClient({ userId: me });
  const space = makeRoom(spaceId, { client, myUserId: me });
  Object.assign(space as unknown as Record<string, unknown>, { name: "Acme", isSpaceRoom: () => true });
  Object.assign(client as unknown as Record<string, unknown>, {
    getRoom: () => space,
    getRoomHierarchy: async () => ({ rooms: [] }),
  });
  MatrixClientPeg.injectClientForTest(client);
  renderWithContext({ spaceId, activeScope: { kind: "space", spaceId } });
  expect(screen.getByRole("heading", { name: "Acme" })).toBeInTheDocument();
});

/**
 * Regression: the context's `spaceId` field is only the VITE_WORKFORCE_SPACE
 * alias lookup, distinct from `activeScope` — which can already be sitting on
 * a space via the ZNC008 single-joined-space fallback even when that alias
 * never resolved. A build without the env var set correctly (or one deployed
 * to a server whose workforce space isn't named `dev`) leaves `spaceId` null
 * while `activeScope` is a real space — the Lobby must follow `activeScope`.
 */
it("renders the Lobby from activeScope even when the workforce-space lookup is null", () => {
  const spaceId = "!space:h.example";
  const client = makeFakeClient({ userId: me });
  const space = makeRoom(spaceId, { client, myUserId: me });
  Object.assign(space as unknown as Record<string, unknown>, { name: "Acme", isSpaceRoom: () => true });
  Object.assign(client as unknown as Record<string, unknown>, {
    getRoom: () => space,
    getRoomHierarchy: async () => ({ rooms: [] }),
  });
  MatrixClientPeg.injectClientForTest(client);
  renderWithContext({ spaceId: null, activeScope: { kind: "space", spaceId } });
  expect(screen.getByRole("heading", { name: "Acme" })).toBeInTheDocument();
});
