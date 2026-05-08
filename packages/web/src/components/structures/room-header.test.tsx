import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { RoomHeader } from "./room-header";

const me = "@me:h.example";
const roomId = "!r:h.example";
afterEach(() => MatrixClientPeg.reset());

function setup(myPL: number) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me, powerLevels: { [me]: myPL } });
  injectStateEvent(
    room,
    mkMatrixEvent({
      roomId,
      sender: "@admin:h.example",
      type: "m.room.power_levels",
      stateKey: "",
      content: { users: { [me]: myPL }, invite: 50, state_default: 50, events_default: 0 },
    }),
  );
  const members = [{ userId: me, name: "me", membership: "join" }];
  (room as unknown as { getJoinedMembers: () => unknown[] }).getJoinedMembers = () => members;
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
    id === roomId ? room : null;
  (client as unknown as { getUser: (id: string) => unknown }).getUser = () => null;
  MatrixClientPeg.injectClientForTest(client);
  return room;
}

describe("<RoomHeader> invite affordance", () => {
  it("shows the Invite button to users with PL ≥ invite", async () => {
    setup(50);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/room/${roomId}`]}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomHeader />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /\d+ member/i }));
    expect(await screen.findByRole("button", { name: /invite/i })).toBeInTheDocument();
  });

  it("hides Invite when PL < invite", async () => {
    setup(0);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/room/${roomId}`]}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomHeader />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /\d+ member/i }));
    expect(screen.queryByRole("button", { name: /invite/i })).not.toBeInTheDocument();
  });

  it("opens the invite dialog on click", async () => {
    setup(100);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/room/${roomId}`]}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomHeader />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /\d+ member/i }));
    await user.click(await screen.findByRole("button", { name: /invite/i }));
    expect(await screen.findByRole("dialog", { name: /invite to room/i })).toBeInTheDocument();
  });
});
