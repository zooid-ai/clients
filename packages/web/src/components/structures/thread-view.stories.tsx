import type { Meta, StoryObj } from "@storybook/react-vite";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { ThreadView } from "./thread-view";

const ME = "@me:h.example";
const AGENT = "@architect.acme:h.example";
const ROOM_ID = "!demo:h.example";
const ROOT_EVENT_ID = "$root-message";

function seedThreadWithLongCommand() {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(ROOM_ID, { client, myUserId: ME });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id: string) =>
    id === ROOM_ID ? room : null;

  const rootEvent = mkMatrixEvent({
    roomId: ROOM_ID,
    sender: ME,
    type: "m.room.message",
    content: { msgtype: "m.text", body: "commit the changes" },
    event_id: ROOT_EVENT_ID,
  });
  pushTimelineEvent(room, rootEvent);

  pushTimelineEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: AGENT,
      type: "dev.zooid.tool_call",
      content: {
        session_id: "s1",
        tool_call_id: "tc1",
        title: "Terminal",
        kind: "execute",
        raw_input: {
          command: "git -C /Users/ori/Code/z/zooid-clients add packages/web/src/components/timeline/approval-card-view.tsx packages/web/src/components/timeline/formatted-message-body.tsx packages/web/src/components/structures/timeline-panel.diff.stories.tsx",
          description: "Stage changed files",
        },
        "m.relates_to": { rel_type: "m.thread", event_id: ROOT_EVENT_ID },
      },
    }),
  );

  pushTimelineEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: AGENT,
      type: "dev.zooid.tool_call_update",
      content: {
        session_id: "s1",
        tool_call_id: "tc1",
        status: "completed",
        "m.relates_to": { rel_type: "m.thread", event_id: ROOT_EVENT_ID },
      },
    }),
  );

  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Structures/ThreadView",
  component: ThreadView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ThreadView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLongCommand: Story = {
  args: { roomId: ROOM_ID, rootEventId: ROOT_EVENT_ID, onBack: () => {} },
  render: (args) => {
    seedThreadWithLongCommand();
    return <ThreadView {...args} />;
  },
};
