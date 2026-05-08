import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { makeFakeClient, makeRoom } from "../../../../test/factories";
import { MatrixClientPeg } from "../../../client/peg";
import { RoomRow } from "./room-row";

const me = "@me:h.example";
afterEach(() => MatrixClientPeg.reset());

describe("<RoomRow>", () => {
  it("toggles the m.favourite tag via the kebab menu", async () => {
    const setTag = vi.fn(async () => undefined);
    const deleteTag = vi.fn(async () => undefined);
    const client = makeFakeClient({ userId: me });
    const room = makeRoom("!r:h.example", { client, myUserId: me });
    (room as unknown as { name: string }).name = "general";
    (client as unknown as { setRoomTag: typeof setTag }).setRoomTag = setTag;
    (client as unknown as { deleteRoomTag: typeof deleteTag }).deleteRoomTag = deleteTag;
    MatrixClientPeg.injectClientForTest(client);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RoomRow room={room} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /room actions/i }));
    await user.click(await screen.findByRole("menuitem", { name: /add to favorites/i }));
    await waitFor(() => expect(setTag).toHaveBeenCalledWith("!r:h.example", "m.favourite", { order: 0.5 }));
  });
});
