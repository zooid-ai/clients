import type { Meta, StoryObj } from "@storybook/react-vite";
import { SlashCommandList } from "./slash-command-list";

const noop = () => {};

const CLIENT_COMMANDS = [
  { name: "clear", description: "Reset the agent's memory of this thread", source: "client" as const },
  { name: "new", description: "Reset the agent's memory of this thread", source: "client" as const },
  { name: "interrupt", description: "Stop the agent's current turn in this thread", source: "client" as const },
  { name: "stop", description: "Stop the agent's current turn in this thread", source: "client" as const },
];

const AGENT_COMMANDS = [
  { name: "plan", description: "Switch to plan mode", source: "agent" as const },
  { name: "compact", description: "Compact the context", source: "agent" as const },
];

const MIXED_COMMANDS = [...CLIENT_COMMANDS, ...AGENT_COMMANDS];

const meta = {
  title: "Rooms/SlashCommandList",
  component: SlashCommandList,
  parameters: { layout: "padded" },
  args: {
    activeIdx: 0,
    onSelect: noop,
    onHover: noop,
  },
} satisfies Meta<typeof SlashCommandList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClientOnly: Story = {
  args: { commands: CLIENT_COMMANDS },
};

export const AgentOnly: Story = {
  args: { commands: AGENT_COMMANDS },
};

export const Mixed: Story = {
  args: { commands: MIXED_COMMANDS },
};

export const ActiveHighlight: Story = {
  args: { commands: MIXED_COMMANDS, activeIdx: 4 },
};
