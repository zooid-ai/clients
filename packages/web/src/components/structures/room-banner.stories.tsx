import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { RoomBanner } from "./room-banner";

const ME = "@me:h.example";
const ROOM_ID = "!demo:h.example";

function seedRoom(opts: { topic?: string; canEdit?: boolean } = {}) {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(ROOM_ID, {
    client,
    myUserId: ME,
    powerLevels: { [ME]: opts.canEdit ? 50 : 0 },
  });
  Object.assign(room as unknown as Record<string, unknown>, { name: "general" });
  if (opts.topic) {
    injectStateEvent(
      room,
      mkMatrixEvent({
        roomId: ROOM_ID,
        sender: "@creator:h.example",
        type: "m.room.topic",
        stateKey: "",
        content: { topic: opts.topic },
      }),
    );
  }
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = (id: string) => (id === ROOM_ID ? room : null);
  cast.joinRoom = async (id: string) => ({ roomId: id });
  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Structures/RoomBanner",
  component: RoomBanner,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="h-[400px] border border-border">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof RoomBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyRoomHero: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedRoom({ topic: "Welcome to #general — the town square for all things Zooid. Say hello!" });
    return <RoomBanner roomId={ROOM_ID} emptyRoom />;
  },
};

export const WithTopic: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedRoom({ topic: "Ship the daemon. Fast, reliable, composable." });
    return <RoomBanner roomId={ROOM_ID} />;
  },
};

export const NoTopic: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedRoom();
    return <RoomBanner roomId={ROOM_ID} />;
  },
};

export const Editable: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedRoom({ topic: "Ship the daemon.", canEdit: true });
    return <RoomBanner roomId={ROOM_ID} onEdit={() => alert("edit topic")} />;
  },
};

export const LongTopic: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedRoom({
      topic:
        "Welcome to #general — the main channel for all Zooid workspace discussion.\n\nFor agent development topics join #zooid. For ops and infrastructure use #ops.\n\nSee https://zoon.eco/docs for the latest docs and release notes. Ping @ori for access issues.\n\nWeekly syncs happen every Thursday at 10am PT.",
    });
    return <RoomBanner roomId={ROOM_ID} />;
  },
};
