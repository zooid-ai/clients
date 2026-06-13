import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { MemberPanel } from "./member-panel";

const me = "@me:h.example";
const roomId = "!r:h.example";
afterEach(() => {
  MatrixClientPeg.reset();
  vi.restoreAllMocks();
});

interface PendingInvitee {
  userId: string;
  name: string;
}

function setupWithPending(powerLevels: Record<string, number>, pending: PendingInvitee[]) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me, powerLevels });
  injectStateEvent(
    room,
    mkMatrixEvent({
      roomId,
      sender: "@admin:h.example",
      type: "m.room.power_levels",
      stateKey: "",
      content: { users: powerLevels, invite: 50, kick: 50, state_default: 50, events_default: 0 },
    }),
  );
  const members = Object.keys(powerLevels).map((userId) => ({
    userId,
    name: userId,
    membership: "join",
  }));
  const kick = vi.fn().mockResolvedValue(undefined);
  Object.assign(room as unknown as Record<string, unknown>, {
    getJoinedMembers: () => members,
    getMembersWithMembership: (m: string) => (m === "invite" ? pending : []),
  });
  Object.assign(client as unknown as Record<string, unknown>, {
    kick,
    getRoom: (id: string) => (id === roomId ? room : null),
    getUser: () => null,
  });
  MatrixClientPeg.injectClientForTest(client);
  return { kick };
}

function setup(powerLevels: Record<string, number>) {
  setupWithPending(powerLevels, []);
}

describe("<MemberPanel> invite affordance", () => {
  it("shows the Invite button to users with PL ≥ invite", () => {
    setup({ [me]: 50 });
    render(<MemberPanel roomId={roomId} spaceId="!space:h.example" />);
    expect(screen.getByRole("button", { name: /invite/i })).toBeInTheDocument();
  });

  it("hides Invite when PL < invite", () => {
    setup({ [me]: 0 });
    render(<MemberPanel roomId={roomId} spaceId="!space:h.example" />);
    expect(screen.queryByRole("button", { name: /invite/i })).not.toBeInTheDocument();
  });

  it("opens the invite dialog on click", async () => {
    setup({ [me]: 100 });
    const user = userEvent.setup();
    render(<MemberPanel roomId={roomId} spaceId="!space:h.example" />);
    await user.click(screen.getByRole("button", { name: /invite/i }));
    expect(await screen.findByRole("dialog", { name: /invite to room/i })).toBeInTheDocument();
  });
});

describe("<MemberPanel> pending invites as section", () => {
  it("shows pending invites as a section, not a nested tab strip", async () => {
    const { kick } = setupWithPending({ [me]: 100 }, [{ userId: "@bob:h.example", name: "bob" }]);
    const user = userEvent.setup();
    render(<MemberPanel roomId={roomId} spaceId="!space:h.example" />);

    expect(screen.getByText(/invited · 1/i)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("bob")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel invite/i }));
    expect(kick).toHaveBeenCalledWith(roomId, "@bob:h.example");
  });

  it("omits the Invited section when there are no pending invites", () => {
    setupWithPending({ [me]: 100 }, []);
    render(<MemberPanel roomId={roomId} spaceId="!space:h.example" />);
    expect(screen.queryByText(/invited/i)).toBeNull();
  });
});

describe("<MemberPanel> role grouping", () => {
  it("renders a heading per occupied role group", () => {
    setup({ [me]: 100, "@bob:h.example": 0 });
    render(<MemberPanel roomId={roomId} spaceId="!space:h.example" />);
    expect(screen.getByText(/Admins/)).toBeInTheDocument();
    expect(screen.getByText(/Members/)).toBeInTheDocument();
    expect(screen.queryByText(/Moderators/)).toBeNull();
  });
});
