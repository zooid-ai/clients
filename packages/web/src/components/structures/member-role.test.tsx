import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, makeRoom, mkMatrixEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { MemberRow } from "./member-row";

const me = "@me:h.example";
const roomId = "!r:h.example";

function makeMembership(userId: string) {
  return mkMatrixEvent({
    roomId,
    sender: userId,
    type: "m.room.member",
    stateKey: userId,
    content: { membership: "join" },
  });
}

function setup(powerLevels: Record<string, number>) {
  const sendStateEvent = vi.fn(
    async (_r: string, _t: string, _c: Record<string, unknown>, _k: string) => ({
      event_id: "$ev",
    }),
  );
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me, powerLevels });
  room.currentState.setStateEvents(Object.keys(powerLevels).map(makeMembership));
  (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
  (client as unknown as { sendStateEvent: typeof sendStateEvent }).sendStateEvent =
    sendStateEvent;
  MatrixClientPeg.injectClientForTest(client);
  return { sendStateEvent };
}

afterEach(() => MatrixClientPeg.reset());

describe("MemberRow roles", () => {
  it("shows each member's role label", () => {
    setup({ [me]: 100, "@bob:h.example": 0 });
    render(<MemberRow roomId={roomId} userId="@bob:h.example" />);
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("renders an editable selector when the viewer outranks the target", () => {
    setup({ [me]: 100, "@bob:h.example": 0 });
    render(<MemberRow roomId={roomId} userId="@bob:h.example" />);
    expect(screen.getByRole("button", { name: /member actions/i })).toBeEnabled();
  });

  it("renders a static, non-interactive role for a peer at or above the viewer", () => {
    setup({ [me]: 50, "@peer:h.example": 50 });
    render(<MemberRow roomId={roomId} userId="@peer:h.example" />);
    expect(screen.queryByRole("button", { name: /moderator/i })).toBeNull();
    expect(screen.getByText("Moderator")).toBeInTheDocument();
  });

  it("disables the selector entirely when the viewer cannot send power_levels", () => {
    // viewer at 0, state_default 50 → no edit anywhere
    setup({ [me]: 0, "@bob:h.example": 0 });
    render(<MemberRow roomId={roomId} userId="@bob:h.example" />);
    expect(screen.queryByRole("button", { name: /default/i })).toBeNull();
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("writes the chosen role's level on selection", async () => {
    const { sendStateEvent } = setup({ [me]: 100, "@bob:h.example": 0 });
    render(<MemberRow roomId={roomId} userId="@bob:h.example" />);
    await userEvent.click(screen.getByRole("button", { name: /member actions/i }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /moderator/i }));
    expect(sendStateEvent).toHaveBeenCalledTimes(1);
    const content = sendStateEvent.mock.calls[0][2] as { users: Record<string, number> };
    expect(content.users["@bob:h.example"]).toBe(50);
  });

  it("disables role options above the viewer's own level", async () => {
    setup({ [me]: 50, "@bob:h.example": 0 });
    render(<MemberRow roomId={roomId} userId="@bob:h.example" />);
    await userEvent.click(screen.getByRole("button", { name: /member actions/i }));
    const admin = await screen.findByRole("menuitemradio", { name: /admin/i });
    expect(admin).toHaveAttribute("aria-disabled", "true");
  });
});
