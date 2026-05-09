import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../../test/factories";
import { MatrixClientPeg } from "../../../client/peg";
import { Sidebar } from "./sidebar";

const me = "@me:h.example";
const spaceId = "!space:h.example";

afterEach(() => MatrixClientPeg.reset());

function seed(opts: { myPL?: number } = {}) {
  const client = makeFakeClient({ userId: me });
  const space = makeRoom(spaceId, {
    client,
    myUserId: me,
    powerLevels: opts.myPL !== undefined ? { [me]: opts.myPL } : undefined,
  });
  // Override with explicit events_default + state_default so the PL hook
  // computes canSendStateEvent("m.space.child") correctly.
  if (opts.myPL !== undefined) {
    injectStateEvent(
      space,
      mkMatrixEvent({
        roomId: spaceId,
        sender: "@admin:h.example",
        type: "m.room.power_levels",
        stateKey: "",
        content: {
          users: { [me]: opts.myPL },
          users_default: 0,
          events_default: 0,
          state_default: 50,
        },
      }),
    );
  }
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
  it("renders three sections and routes each room to its first-claim section", async () => {
    seed();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Sidebar spaceId={spaceId} />
      </MemoryRouter>,
    );
    // DMs is collapsed by default; expand it so we can inspect its rows.
    await user.click(screen.getByRole("button", { name: /toggle DMs section/i }));

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

  it("renders sections in order: Favorites, Rooms, DMs", () => {
    seed();
    render(
      <MemoryRouter>
        <Sidebar spaceId={spaceId} />
      </MemoryRouter>,
    );
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions).toEqual(["Favorites", "Rooms", "DMs"]);
  });

  it("starts with Rooms and Favorites expanded, DMs collapsed", () => {
    seed();
    render(
      <MemoryRouter>
        <Sidebar spaceId={spaceId} />
      </MemoryRouter>,
    );
    const rooms = screen.getByRole("region", { name: "Rooms" });
    const favorites = screen.getByRole("region", { name: "Favorites" });
    const dms = screen.getByRole("region", { name: "DMs" });
    expect(within(rooms).getByText("general")).toBeInTheDocument();
    expect(within(favorites).getByText("starred")).toBeInTheDocument();
    expect(within(dms).queryByText("Bob")).not.toBeInTheDocument();
  });

  it("does not depend on localStorage for default section state", () => {
    // Even with stale 'collapsed' / 'expanded' entries from a prior version
    // of the code, defaults must still apply. (The component should not
    // read these keys.)
    localStorage.setItem("zoon.sidebar.section.rooms", "collapsed");
    localStorage.setItem("zoon.sidebar.section.dms", "expanded");
    localStorage.setItem("zoon.sidebar.section.favorites", "collapsed");
    seed();
    render(
      <MemoryRouter>
        <Sidebar spaceId={spaceId} />
      </MemoryRouter>,
    );
    expect(within(screen.getByRole("region", { name: "Rooms" })).getByText("general")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Favorites" })).getByText("starred")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "DMs" })).queryByText("Bob")).not.toBeInTheDocument();
  });
});

describe("<Sidebar> action affordances", () => {
  it("renders the Add Channel button on the Rooms section header when PL allows", async () => {
    seed({ myPL: 100 });
    render(
      <MemoryRouter>
        <Sidebar spaceId={spaceId} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /add channel/i })).toBeInTheDocument();
  });

  it("hides Add Channel when the user lacks state-event PL", async () => {
    seed({ myPL: 0 });
    render(
      <MemoryRouter>
        <Sidebar spaceId={spaceId} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /add channel/i })).not.toBeInTheDocument();
  });

  it("renders the Start DM button on the DMs section header", async () => {
    seed({ myPL: 0 });
    render(
      <MemoryRouter>
        <Sidebar spaceId={spaceId} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /start dm/i })).toBeInTheDocument();
  });

  it("opens the create-room dialog on Add Channel click", async () => {
    seed({ myPL: 100 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Sidebar spaceId={spaceId} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /add channel/i }));
    expect(await screen.findByRole("dialog", { name: /create channel/i })).toBeInTheDocument();
  });
});
