import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app";
import { MatrixClientPeg } from "../../client/peg";
import { relaxUnhandled, stubStartClient, stubSyncWithRooms } from "../../../test/setup";

const HS = "https://h.example";
const me = "@alice:h.example";

describe("<LoggedInView /> sidebar polish", () => {
  beforeEach(() => {
    relaxUnhandled();
    stubStartClient(HS);
    localStorage.setItem(
      "zoon:session",
      JSON.stringify({
        homeserverUrl: HS,
        accessToken: "tok",
        userId: me,
        deviceId: "DEV1",
      }),
    );
  });
  afterEach(() => {
    MatrixClientPeg.reset();
    localStorage.clear();
  });

  it("renders a sidebar whose header is the space switcher", async () => {
    render(<App config={{ homeserverUrl: HS }} />);
    await waitFor(() =>
      expect(screen.getByTestId("logged-in-view")).toBeInTheDocument(),
    );
    expect(document.querySelector('[data-slot="sidebar"]')).not.toBeNull();
    // The minimal sync stub doesn't seed the workforce space, so scope falls
    // back to Home and the switcher trigger is labeled accordingly.
    const switcher = screen.getByRole("button", { name: /switch space/i });
    expect(switcher).toHaveTextContent(/home/i);
  });

  it("auto-selects the sole joined space when the workforce space doesn't resolve", async () => {
    stubSyncWithRooms(HS, [
      {
        roomId: "!ops:h.example",
        myUserId: me,
        state: [
          { type: "m.room.create", sender: me, stateKey: "", content: { type: "m.space" } },
          { type: "m.room.name", sender: me, stateKey: "", content: { name: "Ops" } },
        ],
      },
    ]);
    render(<App config={{ homeserverUrl: HS }} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /switch space/i })).toHaveTextContent("Ops"),
    );
  });

  it("stays on Home when joined to multiple spaces and none resolves as the workforce space", async () => {
    stubSyncWithRooms(HS, [
      {
        roomId: "!ops:h.example",
        myUserId: me,
        state: [
          { type: "m.room.create", sender: me, stateKey: "", content: { type: "m.space" } },
          { type: "m.room.name", sender: me, stateKey: "", content: { name: "Ops" } },
        ],
      },
      {
        roomId: "!eng:h.example",
        myUserId: me,
        state: [
          { type: "m.room.create", sender: me, stateKey: "", content: { type: "m.space" } },
          { type: "m.room.name", sender: me, stateKey: "", content: { name: "Eng" } },
        ],
      },
    ]);
    render(<App config={{ homeserverUrl: HS }} />);
    await waitFor(() =>
      expect(screen.getByTestId("logged-in-view")).toBeInTheDocument(),
    );
    const switcher = screen.getByRole("button", { name: /switch space/i });
    expect(switcher).toHaveTextContent(/home/i);
  });

  it("toggles the sidebar with Cmd-B / Ctrl-B", async () => {
    const user = userEvent.setup();
    render(<App config={{ homeserverUrl: HS }} />);
    await waitFor(() =>
      expect(screen.getByTestId("logged-in-view")).toBeInTheDocument(),
    );
    const sidebar = document.querySelector('[data-slot="sidebar"]') as HTMLElement;
    expect(sidebar).not.toBeNull();
    expect(sidebar.getAttribute("data-state")).toBe("expanded");

    await user.keyboard("{Meta>}b{/Meta}");
    await waitFor(() => expect(sidebar.getAttribute("data-state")).toBe("collapsed"));

    await user.keyboard("{Meta>}b{/Meta}");
    await waitFor(() => expect(sidebar.getAttribute("data-state")).toBe("expanded"));
  });
});
