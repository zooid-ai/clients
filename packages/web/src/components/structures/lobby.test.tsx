import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { Lobby } from "./lobby";

const me = "@me:h.example";
const spaceId = "!space:h.example";

afterEach(() => MatrixClientPeg.reset());

function Probe() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function setup(opts: { topic?: string; joined?: string[] } = {}) {
  const joined = new Set(opts.joined ?? ["!general:h.example"]);
  const client = makeFakeClient({ userId: me });
  const space = makeRoom(spaceId, { client, myUserId: me });
  Object.assign(space as unknown as Record<string, unknown>, {
    name: "Acme",
    isSpaceRoom: () => true,
  });
  if (opts.topic) {
    injectStateEvent(
      space,
      mkMatrixEvent({
        roomId: spaceId,
        sender: "@a:h.example",
        type: "m.room.topic",
        stateKey: "",
        content: { topic: opts.topic },
      }),
    );
  }
  const joinRoom = vi.fn(async (id: string) => ({ roomId: id }));
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = (id: string) => {
    if (id === spaceId) return space;
    if (!joined.has(id)) return null;
    const room = makeRoom(id, { client, myUserId: me });
    (room as unknown as { getMyMembership: () => string }).getMyMembership = () => "join";
    return room;
  };
  cast.joinRoom = joinRoom;
  cast.getRoomHierarchy = vi.fn(async () => ({
    rooms: [
      { room_id: spaceId, name: "Acme", room_type: "m.space" },
      { room_id: "!general:h.example", name: "general", topic: "town square", num_joined_members: 4 },
      { room_id: "!design:h.example", name: "design", topic: "pixels", num_joined_members: 2 },
      { room_id: "!guides:h.example", name: "Guides", room_type: "m.space", num_joined_members: 9 },
    ],
  }));
  MatrixClientPeg.injectClientForTest(client);
  return { joinRoom };
}

function renderLobby(setScope = vi.fn()) {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Lobby spaceId={spaceId} setScope={setScope} />} />
        <Route path="/room/:roomId" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
  return setScope;
}

it("keeps the space identity the old space-home showed", async () => {
  setup({ topic: "welcome to Acme" });
  renderLobby();
  expect(screen.getByRole("heading", { name: "Acme" })).toBeInTheDocument();
  expect(screen.getByText(/welcome to Acme/)).toBeInTheDocument();
});

it("offers Open for joined rooms and Join for the rest", async () => {
  setup({ joined: ["!general:h.example"] });
  renderLobby();
  const general = await screen.findByRole("listitem", { name: /general/i });
  const design = screen.getByRole("listitem", { name: /design/i });
  expect(within(general).getByRole("button", { name: /open/i })).toBeInTheDocument();
  expect(within(design).getByRole("button", { name: /join/i })).toBeInTheDocument();
});

it("joins an unjoined room and navigates to it", async () => {
  const { joinRoom } = setup();
  renderLobby();
  const design = await screen.findByRole("listitem", { name: /design/i });
  await userEvent.click(within(design).getByRole("button", { name: /join/i }));
  await waitFor(() => expect(joinRoom).toHaveBeenCalledWith("!design:h.example"));
  expect(screen.getByTestId("path")).toHaveTextContent("/room/!design:h.example");
});

it("opens a joined room without re-joining it", async () => {
  const { joinRoom } = setup({ joined: ["!general:h.example"] });
  renderLobby();
  const general = await screen.findByRole("listitem", { name: /general/i });
  await userEvent.click(within(general).getByRole("button", { name: /open/i }));
  expect(screen.getByTestId("path")).toHaveTextContent("/room/!general:h.example");
  expect(joinRoom).not.toHaveBeenCalled();
});

// A space is not a room: joining one has no timeline to land in.
it("enters a subspace by switching scope, not by opening a timeline", async () => {
  setup();
  const setScope = renderLobby();
  const guides = await screen.findByRole("listitem", { name: /guides/i });
  await userEvent.click(within(guides).getByRole("button", { name: /enter/i }));
  expect(setScope).toHaveBeenCalledWith({ kind: "space", spaceId: "!guides:h.example" });
});

it("filters rows by name and by topic", async () => {
  setup();
  renderLobby();
  await screen.findByRole("listitem", { name: /general/i });

  await userEvent.type(screen.getByRole("searchbox", { name: /filter/i }), "pixels");
  expect(screen.queryByRole("listitem", { name: /general/i })).not.toBeInTheDocument();
  expect(screen.getByRole("listitem", { name: /design/i })).toBeInTheDocument();
});

it("hides unjoined rooms behind the Joined filter", async () => {
  setup({ joined: ["!general:h.example"] });
  renderLobby();
  await screen.findByRole("listitem", { name: /design/i });

  await userEvent.click(screen.getByRole("button", { name: /^joined$/i }));
  expect(screen.getByRole("listitem", { name: /general/i })).toBeInTheDocument();
  expect(screen.queryByRole("listitem", { name: /design/i })).not.toBeInTheDocument();
});

it("omits the Spaces section when the space has no subspaces", async () => {
  const client = MatrixClientPeg.safeGet();
  setup();
  (MatrixClientPeg.safeGet() as unknown as Record<string, unknown>).getRoomHierarchy = async () => ({
    rooms: [
      { room_id: spaceId, name: "Acme", room_type: "m.space" },
      { room_id: "!general:h.example", name: "general", num_joined_members: 4 },
    ],
  });
  void client;
  renderLobby();
  await screen.findByRole("listitem", { name: /general/i });
  expect(screen.queryByRole("region", { name: /spaces/i })).not.toBeInTheDocument();
});
