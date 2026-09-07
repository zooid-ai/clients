import type { Meta } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../../test/factories";
import { MatrixClientPeg } from "../../../client/peg";
import { setGlobalSearchEnabled } from "../../../client/feature-flags";
import { Sidebar } from "./sidebar";

const ME = "@me:h.example";
const SPACE_ID = "!space:h.example";

function addChild(space: ReturnType<typeof makeRoom>, roomId: string) {
  injectStateEvent(
    space,
    mkMatrixEvent({
      roomId: space.roomId,
      sender: "@admin:h.example",
      type: "m.space.child",
      stateKey: roomId,
      content: { via: ["h.example"] },
    }),
  );
}

function seedWithSubspaces() {
  const client = makeFakeClient({ userId: ME });
  const space = makeRoom(SPACE_ID, { client, myUserId: ME });
  Object.assign(space as unknown as Record<string, unknown>, { name: "Acme", isSpaceRoom: () => true });

  const general = makeRoom("!general:h.example", { client, myUserId: ME });
  (general as unknown as { name: string }).name = "general";

  const guides = makeRoom("!guides:h.example", { client, myUserId: ME });
  Object.assign(guides as unknown as Record<string, unknown>, { name: "Guides", isSpaceRoom: () => true });
  const onboarding = makeRoom("!onboarding:h.example", { client, myUserId: ME });
  (onboarding as unknown as { name: string }).name = "onboarding";

  const clients = makeRoom("!clients:h.example", { client, myUserId: ME });
  Object.assign(clients as unknown as Record<string, unknown>, { name: "Clients", isSpaceRoom: () => true });
  const acme = makeRoom("!acme-client:h.example", { client, myUserId: ME });
  (acme as unknown as { name: string }).name = "Acme Corp";

  addChild(space, "!general:h.example");
  addChild(space, "!guides:h.example");
  addChild(space, "!clients:h.example");
  addChild(guides, "!onboarding:h.example");
  addChild(clients, "!acme-client:h.example");

  const rooms: Record<string, unknown> = {
    [SPACE_ID]: space,
    "!general:h.example": general,
    "!guides:h.example": guides,
    "!onboarding:h.example": onboarding,
    "!clients:h.example": clients,
    "!acme-client:h.example": acme,
  };
  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = (id: string) => rooms[id] ?? null;
  cast.getRooms = () => Object.values(rooms);
  cast.getAccountData = () => null;
  MatrixClientPeg.injectClientForTest(client);
}

const meta = {
  title: "Structures/Sidebar",
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/"]}>
        <div className="w-64 border border-border">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta;

export default meta;

export const WithSubspaces = {
  render() {
    setGlobalSearchEnabled(true);
    seedWithSubspaces();
    return <Sidebar scope={{ kind: "space", spaceId: SPACE_ID }} workforceSpaceId={SPACE_ID} />;
  },
};

export const SearchHidden = {
  render() {
    setGlobalSearchEnabled(false);
    seedWithSubspaces();
    return <Sidebar scope={{ kind: "space", spaceId: SPACE_ID }} workforceSpaceId={SPACE_ID} />;
  },
};
