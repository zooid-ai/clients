import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { TimelinePanel } from "./timeline-panel";

const ME = "@me:h.example";
const ROOM_ID = "!demo:h.example";

function seedBannerRoom(messageCount: number) {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(ROOM_ID, { client, myUserId: ME });
  Object.assign(room as unknown as Record<string, unknown>, { name: "general" });
  injectStateEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: "@creator:h.example",
      type: "m.room.topic",
      stateKey: "",
      content: { topic: "Welcome to #general — the town square for all Zooid discussion." },
    }),
  );
  for (let i = 0; i < messageCount; i++) {
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        roomId: ROOM_ID,
        sender: ME,
        type: "m.room.message",
        content: { msgtype: "m.text", body: `Message ${i + 1}: shipping fast.` },
      }),
    );
  }
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = (id: string) => (id === ROOM_ID ? room : null);
  cast.joinRoom = async (id: string) => ({ roomId: id });
  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Structures/TimelinePanel (Banner)",
  component: TimelinePanel,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="h-[500px] border border-border overflow-hidden">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof TimelinePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyRoomBanner: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedBannerRoom(0);
    return <TimelinePanel roomId={ROOM_ID} />;
  },
};

export const BannerAboveMessages: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedBannerRoom(3);
    return <TimelinePanel roomId={ROOM_ID} />;
  },
};
