import type { Meta, StoryObj } from "@storybook/react-vite";
import { TypingIndicator } from "./typing-indicator";
const meta = { title: "Rooms/TypingIndicator", component: TypingIndicator, args: { typingUserIds: [], awaitingUserIds: ["@architect.acme:h.example"] } } satisfies Meta<typeof TypingIndicator>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Awaiting: Story = {};
export const AwaitingAndTyping: Story = { args: { typingUserIds: ["@bob:h.example", "@architect.acme:h.example"] } };
export const TwoAwaiting: Story = { args: { awaitingUserIds: ["@architect.acme:h.example", "@claude:h.example"] } };
