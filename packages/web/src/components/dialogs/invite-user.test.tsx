import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  makeFakeClient,
  makeRoom,
  seedWorkforceRoster,
} from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { InviteUserDialog } from "./invite-user";

const me = "@me:h.example";
const roomId = "!r:h.example";
const spaceId = "!space:h.example";

afterEach(() => {
  MatrixClientPeg.reset();
  vi.useRealTimers();
});

function setup(opts: {
  agents?: string[];
  searchResults?: Array<{ user_id: string; display_name?: string }>;
} = {}) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  const space = makeRoom(spaceId, { client, myUserId: me });
  const invite = vi.fn(async () => undefined);
  const search = vi.fn(async () => ({
    results: opts.searchResults ?? [],
    limited: false,
  }));
  (client as unknown as { invite: typeof invite }).invite = invite;
  (
    client as unknown as { searchUserDirectory: typeof search }
  ).searchUserDirectory = search;
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
    id === roomId ? room : id === spaceId ? space : null;
  if (opts.agents?.length) {
    seedWorkforceRoster(
      space,
      opts.agents.map((u) => ({ userId: u })),
    );
  }
  MatrixClientPeg.injectClientForTest(client);
  return { client, invite, search };
}

describe("<InviteUserDialog>", () => {
  it("searches the user directory and shows matching humans", async () => {
    setup({
      agents: ["@planner:h.example"],
      searchResults: [
        { user_id: "@alice:h.example", display_name: "Alice" },
        { user_id: "@planner:h.example", display_name: "planner" },
      ],
    });
    const user = userEvent.setup();
    render(
      <InviteUserDialog open roomId={roomId} spaceId={spaceId} onOpenChange={() => {}} />,
    );

    await user.type(screen.getByPlaceholderText(/search users/i), "a");
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    // Agents are filtered out of search results.
    expect(screen.queryByText("planner")).not.toBeInTheDocument();
  });

  it("invites the selected user and closes", async () => {
    const { invite } = setup({
      searchResults: [{ user_id: "@alice:h.example", display_name: "Alice" }],
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <InviteUserDialog
        open
        roomId={roomId}
        spaceId={spaceId}
        onOpenChange={onOpenChange}
      />,
    );

    await user.type(screen.getByPlaceholderText(/search users/i), "ali");
    await user.click(await screen.findByText("Alice"));
    await user.click(screen.getByRole("button", { name: /^invite$/i }));

    await waitFor(() =>
      expect(invite).toHaveBeenCalledWith(roomId, "@alice:h.example"),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("disables Invite when nothing is selected", async () => {
    setup();
    render(
      <InviteUserDialog open roomId={roomId} spaceId={spaceId} onOpenChange={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /^invite$/i })).toBeDisabled();
  });

  it("shows an empty state when no results match", async () => {
    setup({ searchResults: [] });
    const user = userEvent.setup();
    render(
      <InviteUserDialog open roomId={roomId} spaceId={spaceId} onOpenChange={() => {}} />,
    );
    await user.type(screen.getByPlaceholderText(/search users/i), "zzz");
    expect(await screen.findByText(/no users found/i)).toBeInTheDocument();
  });
});
