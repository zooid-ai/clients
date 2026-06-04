import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { MemberRow } from "./member-row";

const me = "@me:h.example";
const roomId = "!r:h.example";
afterEach(() => {
  MatrixClientPeg.reset();
  vi.restoreAllMocks();
});

function setup(opts: {
  myLevel: number;
  targetLevel?: number;
  kick?: number;
  ban?: number;
}) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me, powerLevels: { [me]: opts.myLevel } });
  injectStateEvent(
    room,
    mkMatrixEvent({
      roomId,
      sender: "@admin:h.example",
      type: "m.room.power_levels",
      stateKey: "",
      content: {
        users: { [me]: opts.myLevel, "@bob:h.example": opts.targetLevel ?? 0 },
        kick: opts.kick ?? 50,
        ban: opts.ban ?? 50,
        state_default: 50,
      },
    }),
  );
  const joined = [
    { userId: me, name: "me", membership: "join" },
    { userId: "@bob:h.example", name: "bob", membership: "join" },
  ];
  Object.assign(room as unknown as Record<string, unknown>, {
    getJoinedMembers: () => joined,
  });
  const kick = vi.fn().mockResolvedValue(undefined);
  const ban = vi.fn().mockResolvedValue(undefined);
  Object.assign(client as unknown as Record<string, unknown>, {
    kick,
    ban,
    getRoom: (id: string) => (id === roomId ? room : null),
  });
  MatrixClientPeg.injectClientForTest(client);
  return { kick, ban };
}

describe("<MemberRow> moderation", () => {
  it("shows kick + ban in the actions menu when I have the power level", async () => {
    setup({ myLevel: 100, targetLevel: 0 });
    const user = userEvent.setup();
    render(<MemberRow roomId={roomId} userId="@bob:h.example" />);
    await user.click(screen.getByRole("button", { name: /member actions/i }));
    expect(screen.getByRole("menuitem", { name: /kick/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /ban/i })).toBeInTheDocument();
  });

  it("hides the actions menu when my PL is below every threshold", () => {
    setup({ myLevel: 0, kick: 50, ban: 50 });
    render(<MemberRow roomId={roomId} userId="@bob:h.example" />);
    expect(screen.queryByRole("button", { name: /member actions/i })).toBeNull();
  });

  it("never shows kick/ban on my own row", async () => {
    setup({ myLevel: 100 });
    const user = userEvent.setup();
    render(<MemberRow roomId={roomId} userId={me} />);
    // The self row may still expose a role control, but never moderation.
    const menu = screen.queryByRole("button", { name: /member actions/i });
    if (menu) await user.click(menu);
    expect(screen.queryByRole("menuitem", { name: /kick/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /ban/i })).toBeNull();
  });

  it("confirms then calls client.kick with the reason", async () => {
    const { kick } = setup({ myLevel: 100, targetLevel: 0 });
    const user = userEvent.setup();
    render(<MemberRow roomId={roomId} userId="@bob:h.example" />);
    await user.click(screen.getByRole("button", { name: /member actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /kick/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "spam");
    await user.click(within(dialog).getByRole("button", { name: /^kick$/i }));
    expect(kick).toHaveBeenCalledWith(roomId, "@bob:h.example", "spam");
  });

  it("cancel-invite calls client.kick (no reason) on a pending row", async () => {
    const { kick } = setup({ myLevel: 100 });
    const user = userEvent.setup();
    render(<MemberRow roomId={roomId} userId="@bob:h.example" membership="invite" />);
    await user.click(screen.getByRole("button", { name: /cancel invite/i }));
    expect(kick).toHaveBeenCalledWith(roomId, "@bob:h.example");
  });
});
