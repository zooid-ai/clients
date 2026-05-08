import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { makeFakeClient, makeRoom } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { CreateRoomDialog } from "./create-room";

const me = "@me:h.example";
const spaceId = "!space:h.example";
afterEach(() => MatrixClientPeg.reset());

function setup() {
  const client = makeFakeClient({ userId: me });
  const space = makeRoom(spaceId, { client, myUserId: me });
  const createRoom = vi.fn(async (_opts: unknown) => ({ room_id: "!new:h.example" }));
  const sendStateEvent = vi.fn(async () => ({ event_id: "$ev" }));
  (client as unknown as { createRoom: typeof createRoom }).createRoom = createRoom;
  (client as unknown as { sendStateEvent: typeof sendStateEvent }).sendStateEvent = sendStateEvent;
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
    id === spaceId ? space : null;
  MatrixClientPeg.injectClientForTest(client);
  return { client, createRoom, sendStateEvent };
}

describe("<CreateRoomDialog>", () => {
  it("creates a public room with the given name + topic and attaches it as a space child", async () => {
    const { createRoom, sendStateEvent } = setup();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={<CreateRoomDialog open spaceId={spaceId} onOpenChange={onOpenChange} />}
          />
          <Route path="/room/:roomId" element={<div data-testid="room-page" />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/name/i), "design");
    await user.type(screen.getByLabelText(/topic/i), "ui chatter");
    await user.click(screen.getByRole("button", { name: /create channel/i }));

    await waitFor(() =>
      expect(createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "design",
          topic: "ui chatter",
          preset: "public_chat",
          initial_state: expect.arrayContaining([
            expect.objectContaining({
              type: "m.space.parent",
              state_key: spaceId,
              content: expect.objectContaining({ canonical: true }),
            }),
          ]),
        }),
      ),
    );
    await waitFor(() =>
      expect(sendStateEvent).toHaveBeenCalledWith(
        spaceId,
        "m.space.child",
        expect.objectContaining({ via: expect.any(Array) }),
        "!new:h.example",
      ),
    );
    await waitFor(() => expect(screen.getByTestId("room-page")).toBeInTheDocument());
  });

  it("creates a private room when the Private radio is selected", async () => {
    const { createRoom } = setup();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CreateRoomDialog open spaceId={spaceId} onOpenChange={() => {}} />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/name/i), "secret");
    await user.click(screen.getByRole("radio", { name: /private/i }));
    await user.click(screen.getByRole("button", { name: /create channel/i }));
    await waitFor(() =>
      expect(createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ preset: "private_chat" }),
      ),
    );
  });

  it("disables submit while name is empty", async () => {
    setup();
    render(
      <MemoryRouter>
        <CreateRoomDialog open spaceId={spaceId} onOpenChange={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /create channel/i })).toBeDisabled();
  });
});
