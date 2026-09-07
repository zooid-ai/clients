import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationCountType } from "matrix-js-sdk";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../../test/factories";
import { MatrixClientPeg } from "../../../client/peg";
import { SpaceSwitcher } from "./space-switcher";
import type { Scope } from "./scope";

const me = "@me:h.example";
const acme = "!acme:h.example";
const beta = "!beta:h.example";

afterEach(() => MatrixClientPeg.reset());

function seedSpaces() {
  const client = makeFakeClient({ userId: me });
  const dev = makeRoom("!dev:h.example", { client, myUserId: me });
  (dev as unknown as { name: string; isSpaceRoom: () => boolean }).name = "Dev";
  (dev as unknown as { isSpaceRoom: () => boolean }).isSpaceRoom = () => true;
  (client as unknown as { getRooms: () => unknown[] }).getRooms = () => [dev];
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
    id === "!dev:h.example" ? dev : null;
  MatrixClientPeg.injectClientForTest(client);
}

/** Two spaces, each with one joined room bearing unread: acme=3, beta=5. */
function seedTwoSpacesWithUnread() {
  const client = makeFakeClient({ userId: me });
  const rooms = new Map<string, ReturnType<typeof makeRoom>>();

  const mkSpace = (id: string, name: string) => {
    const space = makeRoom(id, { client, myUserId: me });
    Object.assign(space as unknown as Record<string, unknown>, {
      name,
      isSpaceRoom: () => true,
      getMyMembership: () => "join",
    });
    rooms.set(id, space);
    return space;
  };
  const mkChild = (id: string, parent: ReturnType<typeof makeRoom>, unread: number) => {
    const room = makeRoom(id, { client, myUserId: me });
    Object.assign(room as unknown as Record<string, unknown>, {
      isSpaceRoom: () => false,
      getMyMembership: () => "join",
    });
    room.setUnreadNotificationCount(NotificationCountType.Total, unread);
    injectStateEvent(
      parent,
      mkMatrixEvent({
        roomId: parent.roomId,
        sender: "@admin:h.example",
        type: "m.space.child",
        stateKey: id,
        content: { via: ["h.example"] },
      }),
    );
    rooms.set(id, room);
  };

  const acmeSpace = mkSpace(acme, "Acme");
  const betaSpace = mkSpace(beta, "Beta");
  mkChild("!a1:h.example", acmeSpace, 3);
  mkChild("!b1:h.example", betaSpace, 5);

  const cast = client as unknown as Record<string, unknown>;
  cast.getRoom = (id: string) => rooms.get(id) ?? null;
  cast.getRooms = () => Array.from(rooms.values());
  MatrixClientPeg.injectClientForTest(client);
}

describe("<SpaceSwitcher>", () => {
  it("shows the active space name as the trigger label", () => {
    seedSpaces();
    const scope: Scope = { kind: "space", spaceId: "!dev:h.example" };
    render(<SpaceSwitcher scope={scope} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /switch space/i })).toHaveTextContent("Dev");
  });

  it("shows Home as the trigger label in home scope", () => {
    seedSpaces();
    render(<SpaceSwitcher scope={{ kind: "home" }} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /switch space/i })).toHaveTextContent(/home/i);
  });

  it("lists Home plus each joined space and selects one", async () => {
    seedSpaces();
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SpaceSwitcher scope={{ kind: "home" }} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /switch space/i }));
    expect(await screen.findByRole("menuitem", { name: /home/i })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Dev" }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "space", spaceId: "!dev:h.example" });
  });

  it("selects Home from a space scope", async () => {
    seedSpaces();
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SpaceSwitcher scope={{ kind: "space", spaceId: "!dev:h.example" }} onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: /switch space/i }));
    await user.click(await screen.findByRole("menuitem", { name: /home/i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "home" });
  });

  it("badges the trigger with unread from spaces you are not in", () => {
    seedTwoSpacesWithUnread(); // acme active (3 unread), beta inactive (5 unread)
    render(
      <MemoryRouter>
        <SpaceSwitcher scope={{ kind: "space", spaceId: acme }} onSelect={vi.fn()} />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole("button", { name: /switch space/i });
    expect(within(trigger).getByLabelText("5 unread")).toBeInTheDocument();
  });

  it("badges each space in the menu with its own unread", async () => {
    seedTwoSpacesWithUnread();
    render(
      <MemoryRouter>
        <SpaceSwitcher scope={{ kind: "space", spaceId: acme }} onSelect={vi.fn()} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: /switch space/i }));
    const beta = await screen.findByRole("menuitem", { name: /beta/i });
    expect(within(beta).getByLabelText("5 unread")).toBeInTheDocument();
  });
});
