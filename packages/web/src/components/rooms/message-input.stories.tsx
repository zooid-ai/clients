import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { RoomMember } from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";
import { makeFakeClient, makeRoom } from "../../../test/factories";
import { MessageInput } from "./message-input";

const ME = "@me:h.example";
const ROOM_ID = "!demo:h.example";

function seed() {
  const client = makeFakeClient({ userId: ME });
  const room = makeRoom(ROOM_ID, { client, myUserId: ME });
  const members = [
    ["@alice:h.example", "alice"],
    ["@coding:h.example", "coding"],
    ["@architect:h.example", "architect"],
  ].map(([id, name]) => {
    const m = new RoomMember(ROOM_ID, id);
    m.name = name;
    return m;
  });
  (room as unknown as { getJoinedMembers: () => RoomMember[] }).getJoinedMembers = () => members;
  (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
  MatrixClientPeg.injectClientForTest(client);
}

function Demo(props: Partial<React.ComponentProps<typeof MessageInput>>) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="w-[28rem]">
      <MessageInput roomId={ROOM_ID} onSubmit={() => {}} error={error} onError={setError} {...props} />
    </div>
  );
}

const meta = {
  title: "Rooms/MessageInput",
  component: MessageInput,
  parameters: { layout: "padded" },
  args: { roomId: ROOM_ID, onSubmit: () => {} },
  decorators: [
    (Story) => {
      seed();
      return <Story />;
    },
  ],
} satisfies Meta<typeof MessageInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <Demo /> };

export const MentionSuggestions: Story = {
  render: () => <Demo className="pt-32" />,
  play: async ({ canvasElement }) => {
    await userEvent.type(await within(canvasElement).findByRole("textbox", { name: /message/i }), "cc @a");
  },
};

export const SlashAndAttachmentsOff: Story = {
  render: () => <Demo slashCommands={false} attachments={false} sendButton={false} placeholder="Add a comment (optional)" />,
};

export const Disabled: Story = {
  render: () => <Demo disabled placeholder="Pick a room first" attachments={false} slashCommands={false} />,
};
