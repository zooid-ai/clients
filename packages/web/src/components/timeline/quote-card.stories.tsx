import type { Meta, StoryObj } from "@storybook/react-vite";
import { QuoteCardView } from "./quote-card";

const TS = Date.UTC(2026, 8, 25, 14, 42);
const noop = () => {};

const AGENT_HTML = `<p>Here is the fix:</p>
<pre><code>const link = buildThreadLink(origin, target);</code></pre>
<ul><li>Room in the path</li><li>Thread in the query</li><li>Event only when it differs</li></ul>`;

const LONG_BODY = Array.from(
  { length: 14 },
  (_, i) => `Line ${i + 1}: a long quoted answer that keeps going so the card has to clamp it.`,
).join("\n");

const meta = {
  title: "Timeline/QuoteCard",
  component: QuoteCardView,
  parameters: { layout: "padded" },
  args: {
    senderId: "@coding:h.example",
    senderName: "Coding",
    sourceRoomId: "!src:h.example",
    ts: TS,
    body: "Shipped it. The link opens the thread and highlights the reply.",
    onOpen: noop,
  },
} satisfies Meta<typeof QuoteCardView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainSameRoom: Story = {};

export const OtherRoom: Story = { args: { roomLabel: "backend" } };

export const FormattedAgentAnswer: Story = {
  args: { body: "Here is the fix", formattedBody: AGENT_HTML },
};

export const LongBodyClamped: Story = { args: { body: LONG_BODY } };

export const DeletedSource: Story = { args: { deleted: true } };

export const ThreadRoot: Story = { args: { replyCount: 12 } };

/** The share preview: no onOpen, so no link role and no hover state. */
export const NonInteractive: Story = { args: { onOpen: undefined, roomLabel: "backend" } };
