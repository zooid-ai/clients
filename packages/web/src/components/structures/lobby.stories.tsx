import type { Meta } from "@storybook/react-vite";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { userEvent, within } from "storybook/test";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { Lobby } from "./lobby";

const ME = "@me:h.example";
const SPACE_ID = "!space:h.example";

function seedSpace(opts: {
  topic?: string;
  joined?: string[];
  hierarchy?: Array<{
    room_id: string;
    name?: string;
    topic?: string;
    room_type?: string;
    num_joined_members?: number;
  }>;
}) {
  const joined = new Set(opts.joined ?? []);
  const client = makeFakeClient({ userId: ME });
  const space = makeRoom(SPACE_ID, { client, myUserId: ME });
  Object.assign(space as unknown as Record<string, unknown>, { name: "Acme", isSpaceRoom: () => true });
  if (opts.topic) {
    injectStateEvent(
      space,
      mkMatrixEvent({
        roomId: SPACE_ID,
        sender: "@creator:h.example",
        type: "m.room.topic",
        stateKey: "",
        content: { topic: opts.topic },
      }),
    );
  }
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = (id: string) => {
    if (id === SPACE_ID) return space;
    if (!joined.has(id)) return null;
    const room = makeRoom(id, { client, myUserId: ME });
    (room as unknown as { getMyMembership: () => string }).getMyMembership = () => "join";
    return room;
  };
  cast.joinRoom = async (id: string) => ({ roomId: id });
  cast.getRoomHierarchy = async () => ({
    rooms: opts.hierarchy ?? [{ room_id: SPACE_ID, name: "Acme", room_type: "m.space" }],
  });
  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Structures/Lobby",
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Story />} />
          <Route path="/room/:roomId" element={<div className="p-6 text-muted-foreground">Room timeline</div>} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta;

export default meta;

const HIERARCHY = [
  { room_id: SPACE_ID, name: "Acme", room_type: "m.space" },
  { room_id: "!general:h.example", name: "general", topic: "town square", num_joined_members: 4 },
  { room_id: "!design:h.example", name: "design", topic: "pixels and prototypes", num_joined_members: 2 },
  { room_id: "!ops:h.example", name: "ops", topic: "deploys and incidents", num_joined_members: 3 },
  { room_id: "!archive:h.example", name: "archive", num_joined_members: 1 },
  { room_id: "!random:h.example", name: "random", num_joined_members: 6 },
  { room_id: "!standup:h.example", name: "standup", num_joined_members: 5 },
  { room_id: "!guides:h.example", name: "Guides", room_type: "m.space", num_joined_members: 9 },
  { room_id: "!clients:h.example", name: "Clients", room_type: "m.space", num_joined_members: 3 },
];

export const Populated = {
  render() {
    seedSpace({
      topic: "Welcome to Acme — your AI-first workspace.",
      joined: ["!general:h.example", "!design:h.example"],
      hierarchy: HIERARCHY,
    });
    return <Lobby spaceId={SPACE_ID} setScope={() => {}} />;
  },
};

export const NothingJoined = {
  render() {
    seedSpace({ topic: "Welcome to Acme.", joined: [], hierarchy: HIERARCHY });
    return <Lobby spaceId={SPACE_ID} setScope={() => {}} />;
  },
};

export const NoSubspaces = {
  render() {
    seedSpace({
      topic: "Welcome to Acme.",
      joined: ["!general:h.example"],
      hierarchy: HIERARCHY.filter((r) => r.room_type !== "m.space" || r.room_id === SPACE_ID),
    });
    return <Lobby spaceId={SPACE_ID} setScope={() => {}} />;
  },
};

export const FilteredEmpty = {
  render() {
    seedSpace({ topic: "Welcome to Acme.", joined: [], hierarchy: HIERARCHY });
    return <Lobby spaceId={SPACE_ID} setScope={() => {}} />;
  },
  async play({ canvasElement }: { canvasElement: HTMLElement }) {
    const canvas = within(canvasElement);
    const filter = await canvas.findByRole("searchbox", { name: /filter/i });
    await userEvent.type(filter, "no such room or space matches this");
  },
};

export const NoTopic = {
  render() {
    seedSpace({ joined: ["!general:h.example"], hierarchy: HIERARCHY });
    return <Lobby spaceId={SPACE_ID} setScope={() => {}} />;
  },
};
