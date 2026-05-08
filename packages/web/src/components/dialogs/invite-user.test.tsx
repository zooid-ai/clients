import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, makeRoom } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { InviteUserDialog } from "./invite-user";

const me = "@me:h.example";
const roomId = "!r:h.example";
afterEach(() => MatrixClientPeg.reset());

function setup() {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  const invite = vi.fn(async () => undefined);
  (client as unknown as { invite: typeof invite }).invite = invite;
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
    id === roomId ? room : null;
  MatrixClientPeg.injectClientForTest(client);
  return { client, invite };
}

describe("<InviteUserDialog>", () => {
  it("calls client.invite(roomId, mxid) on submit", async () => {
    const { invite } = setup();
    const user = userEvent.setup();
    render(<InviteUserDialog open roomId={roomId} onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText(/matrix id/i), "@guest:h.example");
    await user.click(screen.getByRole("button", { name: /invite/i }));
    await waitFor(() => expect(invite).toHaveBeenCalledWith(roomId, "@guest:h.example"));
  });

  it("rejects malformed MXIDs", async () => {
    setup();
    const user = userEvent.setup();
    render(<InviteUserDialog open roomId={roomId} onOpenChange={() => {}} />);
    await user.type(screen.getByLabelText(/matrix id/i), "not-an-mxid");
    expect(screen.getByRole("button", { name: /invite/i })).toBeDisabled();
  });
});
