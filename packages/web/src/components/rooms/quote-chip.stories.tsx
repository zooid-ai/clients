import type { Meta, StoryObj } from "@storybook/react-vite";
import type { QuoteDraft } from "@/lib/quote-draft-store";
import { QuoteChip } from "./quote-chip";

const TS = Date.UTC(2026, 8, 25, 14, 42);

function draft(body: string, senderName = "Coding"): QuoteDraft {
  return {
    senderName,
    quote: {
      room_id: "!src:h.example",
      event_id: "$q",
      thread_id: "$q",
      sender: "@coding:h.example",
      origin_server_ts: TS,
      snapshot: { msgtype: "m.text", body },
    },
  };
}

const meta = {
  title: "Rooms/QuoteChip",
  component: QuoteChip,
  parameters: { layout: "padded" },
  args: { onRemove: () => {} },
  decorators: [
    (Story) => (
      <div className="max-w-xl rounded-lg border border-border p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QuoteChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Short: Story = { args: { draft: draft("Shipped it.") } };

export const LongMultiLine: Story = {
  args: {
    draft: draft(
      "First line of a long answer.\n\nSecond paragraph that goes on and on and on so the chip has to clamp it.\nThird line.\nFourth line.",
    ),
  },
};

export const LongSenderName: Story = {
  args: { draft: draft("Shipped it.", "Architect (on the laptop, running the planning agent)") },
};
