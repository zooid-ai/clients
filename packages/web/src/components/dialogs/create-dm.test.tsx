import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  makeFakeClient,
  makeRoom,
  seedWorkforceRoster,
} from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { CreateDmDialog } from "./create-dm";

const me = "@me:h.example";
const spaceId = "!space:h.example";
afterEach(() => MatrixClientPeg.reset());

function setup(opts: { agents?: string[] } = {}) {
  const client = makeFakeClient({ userId: me });
  const space = makeRoom(spaceId, { client, myUserId: me });
  const createRoom = vi.fn(async () => ({ room_id: "!dm:h.example" }));
  const setAccountData = vi.fn(async () => undefined);
  const getAccountData = vi.fn(() => null);
  (client as unknown as { createRoom: typeof createRoom }).createRoom = createRoom;
  (client as unknown as { setAccountData: typeof setAccountData }).setAccountData = setAccountData;
  (client as unknown as { getAccountData: typeof getAccountData }).getAccountData = getAccountData;

  const members = [
    { userId: me, name: "me", membership: "join" },
    { userId: "@alice:h.example", name: "alice", membership: "join" },
    { userId: "@bob:h.example", name: "bob", membership: "join" },
    { userId: "@planner:h.example", name: "planner", membership: "join" },
  ];
  (space as unknown as { getJoinedMembers: () => unknown[] }).getJoinedMembers = () => members;
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
    id === spaceId ? space : null;

  if (opts.agents?.length) {
    seedWorkforceRoster(
      space,
      opts.agents.map((u) => ({ userId: u })),
    );
  }
  MatrixClientPeg.injectClientForTest(client);
  return { client, createRoom, setAccountData };
}

describe("<CreateDmDialog>", () => {
  it("lists humans only when the workforce roster is ready", async () => {
    setup({ agents: ["@planner:h.example"] });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CreateDmDialog open spaceId={spaceId} onOpenChange={() => {}} />
      </MemoryRouter>,
    );

    await user.click(screen.getByPlaceholderText(/search humans/i));
    expect(await screen.findByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.queryByText("planner")).not.toBeInTheDocument();
  });

  it("creates a 1:1 DM and writes m.direct account data", async () => {
    const { createRoom, setAccountData } = setup({ agents: ["@planner:h.example"] });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={<CreateDmDialog open spaceId={spaceId} onOpenChange={() => {}} />}
          />
          <Route path="/room/:roomId" element={<div data-testid="room-page" />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByPlaceholderText(/search humans/i));
    await user.click(await screen.findByText("alice"));
    await user.click(screen.getByRole("button", { name: /start dm/i }));

    await waitFor(() =>
      expect(createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          is_direct: true,
          preset: "trusted_private_chat",
          invite: ["@alice:h.example"],
        }),
      ),
    );
    await waitFor(() =>
      expect(setAccountData).toHaveBeenCalledWith(
        "m.direct",
        expect.objectContaining({ "@alice:h.example": ["!dm:h.example"] }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("room-page")).toBeInTheDocument());
  });

  it("merges into an existing m.direct event without clobbering", async () => {
    const { client, setAccountData } = setup({ agents: [] });
    (client as unknown as { getAccountData: (t: string) => unknown }).getAccountData = (t) =>
      t === "m.direct"
        ? { getContent: () => ({ "@carol:h.example": ["!old:h.example"] }) }
        : null;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CreateDmDialog open spaceId={spaceId} onOpenChange={() => {}} />
      </MemoryRouter>,
    );
    await user.click(screen.getByPlaceholderText(/search humans/i));
    await user.click(await screen.findByText("alice"));
    await user.click(screen.getByRole("button", { name: /start dm/i }));
    await waitFor(() =>
      expect(setAccountData).toHaveBeenCalledWith("m.direct", {
        "@carol:h.example": ["!old:h.example"],
        "@alice:h.example": ["!dm:h.example"],
      }),
    );
  });

  it("warns when the workforce roster is not ready (fail-open)", () => {
    setup({ agents: undefined });
    render(
      <MemoryRouter>
        <CreateDmDialog open spaceId={spaceId} onOpenChange={() => {}} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/agent list unavailable/i),
    ).toBeInTheDocument();
  });
});
