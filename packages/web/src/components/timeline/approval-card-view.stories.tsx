import type { Meta, StoryObj } from "@storybook/react-vite";
import { ApprovalCardView } from "./approval-card-view";

const meta = {
  title: "Timeline/ApprovalCardView",
  component: ApprovalCardView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ApprovalCardView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "bash",
    subtitle: "pnpm run test",
    canApprove: true,
    options: [],
  },
};

export const LongTitle: Story = {
  args: {
    title: 'bash(pnpm run test --reporter=verbose --config=vitest.config.ts --environment=jsdom --workspace=/Users/ori/Code/z/zooid-clients/packages/web)',
    canApprove: true,
    options: [],
  },
};

export const LongOptionLabels: Story = {
  args: {
    title: "bash",
    subtitle: "pnpm run test --reporter=verbose --config=vitest.config.ts",
    canApprove: true,
    options: [
      { optionId: "1", name: "Allow pnpm run test --reporter=verbose --config=vitest.config.ts --environment=jsdom", kind: "allow_once" },
      { optionId: "2", name: "Reject and explain why the test configuration is invalid for this environment", kind: "reject_once" },
    ],
  },
};

export const Resolved: Story = {
  args: {
    title: 'bash(pnpm run test --reporter=verbose --config=vitest.config.ts --environment=jsdom)',
    canApprove: true,
    options: [],
    resolution: { decision: "allow", respondedBy: "@beno:h.example" },
  },
};
