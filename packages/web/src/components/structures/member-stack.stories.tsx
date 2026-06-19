import type { Meta, StoryObj } from "@storybook/react-vite";
import { roleForLevel } from "../../lib/roles";
import type { MemberRole } from "../../hooks/use-member-roles";
import { MemberStack } from "./member-stack";

const noop = () => {};

function member(localpart: string, displayName: string): MemberRole {
  return {
    userId: `@${localpart}:h.example`,
    displayName,
    powerLevel: 0,
    role: roleForLevel(0),
  };
}

const ROSTER: MemberRole[] = [
  member("alice", "Alice"),
  member("bob", "Bob"),
  member("carol", "Carol"),
  member("dave", "Dave"),
  member("eve", "Eve"),
  member("frank", "Frank"),
  member("grace", "Grace"),
  member("heidi", "Heidi"),
];

const meta = {
  title: "Structures/MemberStack",
  component: MemberStack,
  parameters: { layout: "centered" },
  args: { onToggle: noop },
} satisfies Meta<typeof MemberStack>;

export default meta;
type Story = StoryObj<typeof meta>;

// Eight joined members: three avatars + "+5" overflow.
export const WithOverflow: Story = {
  args: { members: ROSTER },
};

// Exactly the stack size, no overflow chip.
export const NoOverflow: Story = {
  args: { members: ROSTER.slice(0, 3) },
};

// Two members fit with no overflow.
export const Pair: Story = {
  args: { members: ROSTER.slice(0, 2) },
};

// Solo room — just you.
export const OnlyYou: Story = {
  args: { members: ROSTER.slice(0, 1) },
};

export const Pressed: Story = {
  args: { members: ROSTER, open: true },
};
