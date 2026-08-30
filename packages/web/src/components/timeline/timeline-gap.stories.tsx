import type { Meta, StoryObj } from "@storybook/react-vite";
import { TimelineGap } from "./timeline-gap";

const meta = {
  title: "Timeline/TimelineGap",
  component: TimelineGap,
  parameters: { layout: "padded" },
  args: { onClick: () => {} },
} satisfies Meta<typeof TimelineGap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Resting state: a hole the user can click to backfill. */
export const Idle: Story = {
  args: { loading: false },
};

/** Mid-fetch: spinner, disabled, so a second click can't stack requests. */
export const Loading: Story = {
  args: { loading: true },
};

/**
 * Narrow column — the dashed rules either side have to collapse gracefully
 * rather than push the pill out of the container.
 */
export const Narrow: Story = {
  args: { loading: false },
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
};
