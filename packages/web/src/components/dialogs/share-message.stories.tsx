import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { MatrixClientPeg } from "@/client/peg";
import { makeFakeClient, makeRoom } from "../../../test/factories";
import { ShareMessageDialog } from "./share-message";

const ME = "@me:h.example";
const TS = Date.UTC(2026, 8, 25, 14, 42);

const draft = {
  senderName: "Coding",
  quote: {
    room_id: "!product:h.example",
    event_id: "$q",
    thread_id: "$q",
    sender: "@coding:h.example",
    origin_server_ts: TS,
    snapshot: { msgtype: "m.text", body: "Shipped it. The link opens the thread and highlights the reply." },
  },
};

function seed(opts: { failSend?: boolean } = {}) {
  const client = makeFakeClient({ userId: ME });
  for (const [id, name] of [
    ["!product:h.example", "product"],
    ["!backend:h.example", "backend"],
    ["!design:h.example", "design"],
    ["!ops:h.example", "ops"],
  ]) {
    const room = makeRoom(id, { client, myUserId: ME });
    room.name = name;
    room.updateMyMembership("join");
    (client as unknown as { addRoom(r: unknown): void }).addRoom(room);
  }
  (client as unknown as Record<string, unknown>).sendEvent = () =>
    opts.failSend ? Promise.reject(new Error("You don't have permission to post there")) : Promise.resolve({ event_id: "$s" });
  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Dialogs/ShareMessageDialog",
  component: ShareMessageDialog,
  parameters: { layout: "fullscreen" },
  args: { open: true, onOpenChange: () => {}, title: "Share message", draft },
} satisfies Meta<typeof ShareMessageDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NothingSelected: Story = {
  render: (args) => {
    seed();
    return <ShareMessageDialog {...args} />;
  },
};

export const RoomSelectedWithComment: Story = {
  render: (args) => {
    seed();
    return <ShareMessageDialog {...args} />;
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("option", { name: "backend" }));
    await userEvent.type(await body.findByRole("textbox", { name: /comment/i }), "fyi, see the answer below");
  },
};

export const SearchWithNoMatches: Story = {
  render: (args) => {
    seed();
    return <ShareMessageDialog {...args} />;
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(await body.findByRole("textbox", { name: /search rooms/i }), "zzz");
  },
};

export const SendError: Story = {
  render: (args) => {
    seed({ failSend: true });
    return <ShareMessageDialog {...args} />;
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("option", { name: "backend" }));
    await userEvent.click(await body.findByRole("button", { name: /^send$/i }));
  },
};
