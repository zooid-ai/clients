import type { Meta, StoryObj } from "@storybook/react-vite";
import { DiffView } from "./diff-view";

const meta = {
  title: "Timeline/DiffView",
  component: DiffView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DiffView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Replace: Story = {
  args: {
    diff: {
      path: "/repo/src/auth.ts",
      oldText: "export function login(user: string) {\n  return fetch('/login', { method: 'POST' })\n}\n",
      newText: "export async function login(user: string, password: string) {\n  return fetch('/login', { method: 'POST', body: JSON.stringify({ user, password }) })\n}\n",
    },
  },
};

export const AddOnly: Story = {
  args: {
    diff: {
      path: "/repo/src/helpers/new-file.ts",
      oldText: "",
      newText: "export const PI = 3.14159\nexport const E = 2.71828\n",
    },
  },
};

export const DelOnly: Story = {
  args: {
    diff: {
      path: "/repo/src/legacy.ts",
      oldText: "export function oldHelper() {\n  return 'deprecated'\n}\n",
      newText: "",
    },
  },
};

export const Large: Story = {
  args: {
    diff: {
      path: "/repo/src/components/large-component.tsx",
      oldText: Array.from({ length: 40 }, (_, i) => `line ${i + 1}: old content here\n`).join(""),
      newText: [
        ...Array.from({ length: 20 }, (_, i) => `line ${i + 1}: old content here\n`),
        ...Array.from({ length: 20 }, (_, i) => `line ${i + 21}: NEW content here\n`),
        ...Array.from({ length: 20 }, (_, i) => `extra ${i + 1}: added line\n`),
      ].join(""),
    },
  },
};
