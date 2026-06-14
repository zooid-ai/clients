import type { Meta, StoryObj } from "@storybook/react-vite";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { TimelinePanel } from "./timeline-panel";

const ME = "@me:h.example";
const AGENT = "@architect.acme:h.example";
const ROOM_ID = "!demo:h.example";

function seedDiffRoom() {
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
      content: { msgtype: "m.text", body: "Can you fix the auth module?" },
    }),
  );

  pushTimelineEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: AGENT,
      type: "eco.zoon.tool_call",
      content: {
        session_id: "s1",
        tool_call_id: "tc1",
        title: "Edit auth.ts",
        kind: "edit",
      },
    }),
  );

  pushTimelineEvent(
    room,
    mkMatrixEvent({
      roomId: ROOM_ID,
      sender: AGENT,
      type: "eco.zoon.tool_call_update",
      content: {
        session_id: "s1",
        tool_call_id: "tc1",
        status: "completed",
        content: [
          {
            type: "diff",
            path: "/repo/src/auth.ts",
            oldText: "export function login(user: string) {\n  return fetch('/login')\n}\n",
            newText: "export async function login(user: string, password: string) {\n  const res = await fetch('/login', {\n    method: 'POST',\n    body: JSON.stringify({ user, password }),\n  })\n  return res.json()\n}\n",
          },
        ],
      },
    }),
  );

  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Structures/TimelinePanel (Diff)",
  component: TimelinePanel,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TimelinePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithEditDiff: Story = {
  args: { roomId: ROOM_ID },
  render: () => {
    seedDiffRoom();
    return <TimelinePanel roomId={ROOM_ID} />;
  },
};
