import type { Meta } from "@storybook/react-vite";
import { SpaceChildRow } from "./space-child-row";

const meta = {
  title: "Structures/SpaceChildRow",
  render: (args) => (
    <ul className="w-96">
      <SpaceChildRow {...args} />
    </ul>
  ),
} satisfies Meta<typeof SpaceChildRow>;

export default meta;

export const JoinedRoom = {
  args: {
    name: "general",
    topic: "town square",
    memberCount: 4,
    kind: "room",
    joined: true,
    onActivate: () => {},
  },
};

export const UnjoinedRoom = {
  args: {
    name: "design",
    topic: "pixels and prototypes",
    memberCount: 2,
    kind: "room",
    joined: false,
    onActivate: () => {},
  },
};

export const Subspace = {
  args: {
    name: "Guides",
    topic: "onboarding docs for the whole space",
    memberCount: 9,
    kind: "space",
    joined: false,
    onActivate: () => {},
  },
};

export const NoTopic = {
  args: {
    name: "random",
    memberCount: 1,
    kind: "room",
    joined: true,
    onActivate: () => {},
  },
};

export const LongEverything = {
  args: {
    name: "a".repeat(120),
    topic: "b".repeat(120),
    memberCount: 42,
    kind: "room",
    joined: false,
    onActivate: () => {},
  },
};

export const SingleMember = {
  args: {
    name: "solo",
    memberCount: 1,
    kind: "room",
    joined: false,
    onActivate: () => {},
  },
};
