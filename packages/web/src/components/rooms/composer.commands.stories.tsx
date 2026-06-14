import type { Meta, StoryObj } from "@storybook/react-vite";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { Composer } from "./composer";

const ME = "@me:h.example";
const AGENT = "@agent.acme:h.example";
const ROOM_ID = "!demo:h.example";
const THREAD_ROOT = "$thread-root:h.example";

function seedCommandRoom() {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(ROOM_ID, { client, myUserId: ME });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id: string) =>
    id === ROOM_ID ? room : null;
  (client as unknown as { sendEvent: unknown }).sendEvent = () => Promise.resolve({ event_id: "$m1" });

  pushTimelineEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: AGENT,
      type: "eco.zoon.available_commands_update",
      content: {
        session_id: "s1",
        available_commands: [
          { name: "plan", description: "Switch to plan mode" },
          { name: "compact", description: "Compact the context" },
          { name: "resume", description: "Resume from last checkpoint" },
        ],
      },
    }),
  );

  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Rooms/Composer (Commands)",
  component: Composer,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAdvertisedCommands: Story = {
  args: { roomId: ROOM_ID, threadRootEventId: THREAD_ROOT },
  render: (args) => {
    seedCommandRoom();
    return <Composer {...args} />;
  },
};
