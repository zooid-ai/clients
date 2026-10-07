import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { ThreadView } from "./thread-view";

const ME = "@me:h.example";
const AGENT = "@architect.acme:h.example";

type Step = "msg" | "reply" | "hole";

/**
 * Reproduces a thread that straddles a gappy sync: replies on both sides of an
 * unjoined timeline boundary, with the replies in between not loaded. Every
 * event carries an explicit `ts` — the "hole after the root" rule compares
 * timestamps, and events pushed in the same millisecond would tie.
 */
function seed(roomId: string, rootId: string, steps: Step[], paginate: () => Promise<boolean>) {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(roomId, { client, myUserId: ME, timelineSupport: true });
  Object.assign(client as unknown as Record<string, unknown>, {
    getRoom: (id: string) => (id === roomId ? room : null),
    paginateEventTimeline: paginate,
  });

  let ts = 1_000;
  const push = (eventId: string, sender: string, body: string, thread: boolean) => {
    ts += 100;
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        eventId,
        roomId,
        sender,
        ts,
        type: "m.room.message",
        content: {
          msgtype: "m.text",
          body,
          ...(thread ? { "m.relates_to": { rel_type: "m.thread", event_id: rootId } } : {}),
        },
      }),
    );
  };

  let n = 0;
  for (const step of steps) {
    n += 1;
    if (step === "hole") {
      ts += 2_000;
      room.resetLiveTimeline(`hole_tok_${n}`, `old_sync_tok_${n}`);
    } else if (step === "reply") {
      push(`$${roomId}-r${n}`, AGENT, `Reply ${n} in the thread.`, true);
    } else {
      push(`$${roomId}-m${n}`, ME, `Unrelated message ${n}.`, false);
    }
  }
  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Structures/ThreadView (Gap)",
  component: ThreadView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ThreadView>;

export default meta;
type Story = StoryObj<typeof meta>;

// The root is the first (or, for HoleBeforeRoot, fourth) "msg" step, so its id
// is derived from the room id and its step number in seed().
const WITH_GAP = { roomId: "!gap-with:h.example", rootId: "$!gap-with:h.example-m1" };
const FILLING = { roomId: "!gap-filling:h.example", rootId: "$!gap-filling:h.example-m1" };
const BEFORE_ROOT = { roomId: "!gap-before:h.example", rootId: "$!gap-before:h.example-m4" };
const SEVERAL = { roomId: "!gap-several:h.example", rootId: "$!gap-several:h.example-m1" };

const noMore = async () => false;

// Root, two replies, a hole, two more replies: one marker between reply 2 and 3.
export const WithHistoryGap: Story = {
  args: { roomId: WITH_GAP.roomId, rootEventId: WITH_GAP.rootId, onBack: () => {} },
  render: (args) => {
    seed(args.roomId, args.rootEventId, ["msg", "reply", "reply", "hole", "reply", "reply"], noMore);
    return <ThreadView {...args} />;
  },
};

// Same seed; the fill never settles, so the marker stays in its loading state.
export const FillingGap: Story = {
  args: { roomId: FILLING.roomId, rootEventId: FILLING.rootId, onBack: () => {} },
  render: (args) => {
    seed(
      args.roomId,
      args.rootEventId,
      ["msg", "reply", "reply", "hole", "reply", "reply"],
      () => new Promise<boolean>(() => {}),
    );
    return <ThreadView {...args} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", { name: /load missing messages/i });
    await userEvent.setup({ pointerEventsCheck: 0 }).click(button);
  },
};

// The hole sits before the root, so nothing of this thread is above it.
export const HoleBeforeRoot: Story = {
  args: { roomId: BEFORE_ROOT.roomId, rootEventId: BEFORE_ROOT.rootId, onBack: () => {} },
  render: (args) => {
    seed(args.roomId, args.rootEventId, ["msg", "msg", "hole", "msg", "reply", "reply"], noMore);
    return <ThreadView {...args} />;
  },
};

// Two holes resolve to the same reply, so they show as one marker.
export const SeveralHolesOneMarker: Story = {
  args: { roomId: SEVERAL.roomId, rootEventId: SEVERAL.rootId, onBack: () => {} },
  render: (args) => {
    seed(args.roomId, args.rootEventId, ["msg", "reply", "hole", "msg", "hole", "reply"], noMore);
    return <ThreadView {...args} />;
  },
};
