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

/**
 * The agent-room shape of the same hole: everything that arrived after it is a
 * thread reply, which the room view hides, and the thread's root was posted
 * inside the hole, so the client fetches it on its own and it sits in no
 * timeline. The marker still has to land between the two threads.
 */
function seedGappyThreadedRoom() {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(ROOM_ID, { client, myUserId: ME, timelineSupport: true });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id: string) =>
    id === ROOM_ID ? room : null;

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const NEW_ROOT = "$standup-root";
  (client as unknown as Record<string, unknown>).fetchRoomEvent = async () => ({
    event_id: NEW_ROOT,
    room_id: ROOM_ID,
    sender: ME,
    type: "m.room.message",
    content: { msgtype: "m.text", body: "Morning standup: what needs me today?" },
    origin_server_ts: now - 3 * hour,
  });

  const say = (eventId: string, sender: string, body: string, ts: number, root?: string) =>
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        eventId,
        roomId: ROOM_ID,
        sender,
        type: "m.room.message",
        content: {
          msgtype: "m.text",
          body,
          ...(root && { "m.relates_to": { rel_type: "m.thread", event_id: root } }),
        },
        ts,
      }),
    );

  say("$old-root", ME, "Can you take a look at the auth module?", now - 14 * hour);
  say("$old-r1", AGENT, "Starting now.", now - 14 * hour + 60_000, "$old-root");

  room.resetLiveTimeline("prev_batch_tok", "old_sync_tok");

  say("$new-r1", AGENT, "Two PRs are waiting on your review.", now - 2 * hour, NEW_ROOT);
  say("$new-r2", AGENT, "And one spec needs a decision.", now - 2 * hour + 60_000, NEW_ROOT);

  MatrixClientPeg.injectClientForTest(client);
}

export const WithHistoryGapBeforeFetchedThread: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedGappyThreadedRoom();
    return (
      <div style={{ height: "100vh" }}>
        <TimelinePanel roomId={ROOM_ID} />
      </div>
    );
  },
};
