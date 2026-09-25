import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { QUOTE_FIELD, type QuoteRef } from "@/lib/matrix/quote";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { TimelinePanel } from "./timeline-panel";

const ME = "@me:h.example";
const AGENT = "@coding.acme:h.example";
const HERE = "!here:h.example";
const OTHER = "!elsewhere:h.example";
const TS = Date.UTC(2026, 8, 25, 14, 42);

const fallbackFor = (body: string) =>
  `> Coding · 2026-09-25 14:42 UTC · https://app.example/room/!here%3Ah.example?thread=%24agent\n> ${body}`;

function quoteOf(roomId: string, eventId: string, body: string): QuoteRef {
  return {
    room_id: roomId,
    event_id: eventId,
    thread_id: eventId,
    sender: AGENT,
    origin_server_ts: TS,
    snapshot: { msgtype: "m.text", body },
  };
}

function seed() {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(HERE, { client, myUserId: ME });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id: string) =>
    id === HERE ? room : null;

  const say = (sender: string, eventId: string, content: Record<string, unknown>) =>
    pushTimelineEvent(
      room,
      mkMatrixEvent({ roomId: HERE, sender, eventId, type: "m.room.message", content }),
    );

  say(ME, "$human", { msgtype: "m.text", body: "Can you sum up the link format?" });
  say(AGENT, "$agent", {
    msgtype: "m.text",
    body: "Links carry the room in the path and the thread in the query.",
  });
  // Live: the source is in this room's timeline, so the card shows current text.
  say(ME, "$q-live", {
    msgtype: "m.text",
    body: `Nice, this is what I meant.\n\n${fallbackFor("Links carry the room in the path and the thread in the query.")}`,
    [QUOTE_FIELD]: quoteOf(HERE, "$agent", "Links carry the room in the path and the thread in the query."),
  });
  // Snapshot: the source room isn't in the client, so the card falls back to the stored text.
  say(ME, "$q-snap", {
    msgtype: "m.text",
    body: `Sharing this from the other room.\n\n${fallbackFor("Deploy is green.")}`,
    [QUOTE_FIELD]: quoteOf(OTHER, "$far", "Deploy is green."),
  });
  // Bare quote: no comment, only the card.
  say(ME, "$q-bare", {
    msgtype: "m.text",
    body: fallbackFor("Deploy is green."),
    [QUOTE_FIELD]: quoteOf(OTHER, "$far", "Deploy is green."),
  });

  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Structures/TimelinePanel (Quotes)",
  component: TimelinePanel,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TimelinePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const QuoteMessage: Story = {
  args: { roomId: HERE },
  render: () => {
    seed();
    return <TimelinePanel roomId={HERE} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const agentText = await canvas.findByText(/Links carry the room in the path/, { selector: "p" });
    await userEvent.hover(agentText);
    const buttons = await canvas.findAllByRole("button", { name: /more actions/i });
    await userEvent.click(buttons[1]);
  },
};
