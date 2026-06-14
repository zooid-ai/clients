import type { Meta, StoryObj } from "@storybook/react-vite";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { TimelinePanel } from "./timeline-panel";

const ME = "@me:h.example";
const AGENT = "@architect.acme:h.example";
const ROOM_ID = "!demo:h.example";

function seedPlanRoom() {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(ROOM_ID, { client, myUserId: ME });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id: string) =>
    id === ROOM_ID ? room : null;

  pushTimelineEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: ME,
      type: "m.room.message",
      content: { msgtype: "m.text", body: "Hey, can you make a grocery list?" },
    }),
  );
  // Tool call card appears in timeline
  pushTimelineEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: AGENT,
      type: "eco.zoon.tool_call",
      content: {
        session_id: "s1",
        tool_call_id: "tc1",
        title: "TodoWrite",
        kind: "other",
        raw_input: { todos: [{ content: "Buy bananas", status: "pending" }] },
      },
    }),
  );
  // eco.zoon.plan renders as membership-style "Agent updated plan" tile in the timeline.
  // The plan board itself is mounted in the composer area (RoomView), not here.
  pushTimelineEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: AGENT,
      type: "eco.zoon.plan",
      content: {
        session_id: "s1",
        entries: [
          { content: "Buy bananas", status: "completed" },
          { content: "Buy bread", status: "in_progress" },
          { content: "Buy milk", status: "pending" },
        ],
      },
    }),
  );

  MatrixClientPeg.injectClientForTest(client);
}

function seedToolCallOnlyRoom() {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(ROOM_ID, { client, myUserId: ME });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id: string) =>
    id === ROOM_ID ? room : null;

  pushTimelineEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: ME,
      type: "m.room.message",
      content: { msgtype: "m.text", body: "Make a grocery list." },
    }),
  );
  // When only a tool_call with planning input exists (no eco.zoon.plan event yet),
  // the plan board in the composer area uses planEntriesFromToolInput as a fallback.
  // In the timeline this still just shows as a tool call card.
  pushTimelineEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: AGENT,
      type: "eco.zoon.tool_call",
      content: {
        session_id: "s1",
        tool_call_id: "tc2",
        title: "TodoWrite",
        kind: "other",
        raw_input: {
          todos: [
            { content: "Buy bananas", status: "completed" },
            { content: "Buy bread", status: "in_progress" },
            { content: "Buy milk", status: "pending" },
          ],
        },
      },
    }),
  );

  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Structures/TimelinePanel (Plan)",
  component: TimelinePanel,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TimelinePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// Shows: tool call card + "Agent updated plan" membership tile in the timeline.
// The plan board (checklist) lives in the composer area (RoomView) — not shown here.
export const WithPlanEvent: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedPlanRoom();
    return <TimelinePanel roomId={ROOM_ID} />;
  },
};

// Shows: tool call card only (no plan event → no membership tile).
// When shown in the app (thread view), the plan board would use the tool call as a fallback.
export const WithToolCallFallback: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedToolCallOnlyRoom();
    return <TimelinePanel roomId={ROOM_ID} />;
  },
};
