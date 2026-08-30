import type { Meta, StoryObj } from "@storybook/react-vite";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { TimelinePanel } from "./timeline-panel";

const ME = "@me:h.example";
const AGENT = "@architect.acme:h.example";
const ROOM_ID = "!gap:h.example";

/**
 * Reproduces what the client is left holding after the tab has been idle and
 * the reconnect sync came back `limited: true`: two stretches of history in the
 * same timeline set, unjoined, with messages missing in between. The marker has
 * to land at that boundary — mid-conversation — not at the top of the panel.
 */
function seedGappyRoom() {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(ROOM_ID, { client, myUserId: ME, timelineSupport: true });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id: string) =>
    id === ROOM_ID ? room : null;

  const say = (sender: string, body: string) =>
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        roomId: ROOM_ID,
        sender,
        type: "m.room.message",
        content: { msgtype: "m.text", body },
      }),
    );

  say(ME, "Can you take a look at the auth module?");
  say(AGENT, "Starting now — I'll read through it first.");

  // The gappy sync: fork a new timeline carrying a prev_batch, leaving the
  // older one reachable but not linked.
  room.resetLiveTimeline("prev_batch_tok", "old_sync_tok");

  say(AGENT, "Done — the token refresh was dropping the retry.");
  say(ME, "Nice. What was the root cause?");

  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Structures/TimelinePanel",
  component: TimelinePanel,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TimelinePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHistoryGap: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedGappyRoom();
    return (
      <div style={{ height: "100vh" }}>
        <TimelinePanel roomId={ROOM_ID} />
      </div>
    );
  },
};
