import type { Meta, StoryObj } from "@storybook/react-vite";
import { UserAvatar } from "@/components/user-avatar";
import { senderColor } from "@/lib/sender";
import { DateDivider } from "./date-divider";
import { MessageTile } from "./message-tile";
import { MessageTimestamp } from "./message-timestamp";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function Row({
  userId,
  name,
  ts,
  body,
}: {
  userId: string;
  name: string;
  ts: number;
  body: string;
}) {
  return (
    <MessageTile
      className="hover:bg-muted/30"
      avatar={<UserAvatar userId={userId} size="sm" />}
      senderName={name}
      senderColor={senderColor(userId)}
      senderTitle={userId}
      timestamp={<MessageTimestamp ts={ts} />}
    >
      <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
        {body}
      </p>
    </MessageTile>
  );
}

const meta = {
  title: "Timeline/Timestamps",
  component: MessageTile,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MessageTile>;

export default meta;
type Story = StoryObj<typeof meta>;

// A mini timeline spanning two days, showing per-message relative timestamps
// and the day-boundary divider.
export const TimelineWithDayBoundary: Story = {
  render: () => {
    const now = Date.now();
    return (
      <ol className="flex max-w-xl flex-col gap-0.5">
        <DateDivider label="Yesterday" />
        <Row userId="@alice:h.example" name="Alice" ts={now - DAY - 2 * HOUR} body="Shipping the avatar stack today." />
        <Row userId="@bob:h.example" name="Bob" ts={now - DAY - HOUR} body="Nice — I'll review it." />
        <DateDivider label="Today" />
        <Row userId="@alice:h.example" name="Alice" ts={now - 2 * HOUR} body="Merged. Timestamps next." />
        <Row userId="@bob:h.example" name="Bob" ts={now - 5 * MIN} body="Looks great." />
        <Row userId="@carol:h.example" name="Carol" ts={now - 20_000} body="🎉" />
      </ol>
    );
  },
};
