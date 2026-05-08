import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../../test/factories";
import { MatrixClientPeg } from "../../../client/peg";
import { Sidebar } from "./sidebar";

const me = "@me:h.example";
const spaceId = "!space:h.example";

afterEach(() => MatrixClientPeg.reset());

function seed() {
  const client = makeFakeClient({ userId: me });
  const space = makeRoom(spaceId, { client, myUserId: me });
  const general = makeRoom("!general:h.example", { client, myUserId: me });
  (general as unknown as { name: string }).name = "general";
  const dm = makeRoom("!dm:h.example", { client, myUserId: me });
  (dm as unknown as { name: string }).name = "Bob";
  const fav = makeRoom("!fav:h.example", { client, myUserId: me });
  (fav as unknown as { name: string; tags: Record<string, unknown> }).name = "starred";
  (fav as unknown as { tags: Record<string, unknown> }).tags = { "m.favourite": { order: 0.5 } };

  injectStateEvent(
    space,
    mkMatrixEvent({
      roomId: spaceId,
      sender: "@admin:h.example",
      type: "m.space.child",
      stateKey: "!general:h.example",
      content: { via: ["h.example"] },
    }),
  );
  injectStateEvent(
    space,
    mkMatrixEvent({
      roomId: spaceId,
      sender: "@admin:h.example",
      type: "m.space.child",
      stateKey: "!fav:h.example",
      content: { via: ["h.example"] },
    }),
  );

  const rooms: Record<string, unknown> = {
    [spaceId]: space,
    "!general:h.example": general,
    "!dm:h.example": dm,
    "!fav:h.example": fav,
  };
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) => rooms[id] ?? null;
  (client as unknown as { getRooms: () => unknown[] }).getRooms = () => Object.values(rooms);
  (client as unknown as { getAccountData: (t: string) => unknown }).getAccountData = (t) =>
    t === "m.direct" ? { getContent: () => ({ "@bob:h.example": ["!dm:h.example"] }) } : null;
  MatrixClientPeg.injectClientForTest(client);
}

describe("<Sidebar>", () => {
  it("renders three sections and routes each room to its first-claim section", () => {
    seed();
    render(
      <MemoryRouter>
        <Sidebar spaceId={spaceId} />
      </MemoryRouter>,
    );

    const favorites = screen.getByRole("region", { name: "Favorites" });
    const dms = screen.getByRole("region", { name: "DMs" });
    const rooms = screen.getByRole("region", { name: "Rooms" });

    // !fav is favorited AND a space child — should appear in Favorites only.
    expect(within(favorites).getByText("starred")).toBeInTheDocument();
    expect(within(rooms).queryByText("starred")).not.toBeInTheDocument();

    // !dm is in m.direct — appears in DMs.
    expect(within(dms).getByText("Bob")).toBeInTheDocument();
    expect(within(rooms).queryByText("Bob")).not.toBeInTheDocument();

    // !general is plain space child — appears in Rooms.
    expect(within(rooms).getByText("general")).toBeInTheDocument();
  });
});
