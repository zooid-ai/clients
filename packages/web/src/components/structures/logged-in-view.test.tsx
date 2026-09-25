import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app";
import { MatrixClientPeg } from "../../client/peg";
import { mswServer, relaxUnhandled, stubStartClient, stubSyncWithRooms } from "../../../test/setup";

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

describe("<LoggedInView /> workforce space from runtime config", () => {
  const space = (roomId: string, name: string) => ({
    roomId,
    myUserId: me,
    state: [
      { type: "m.room.create", sender: me, stateKey: "", content: { type: "m.space" } },
      { type: "m.room.name", sender: me, stateKey: "", content: { name } },
    ],
  });
  const aliases: Record<string, string> = {
    "#dev:h.example": "!dev:h.example",
    "#ops:h.example": "!ops:h.example",
    "#eng:h.example": "!eng:h.example",
  };

  beforeEach(() => {
    relaxUnhandled();
    stubStartClient(HS);
    mswServer.use(
      http.get(`${HS}/_matrix/client/v3/directory/room/:alias`, ({ params }) => {
        const roomId = aliases[decodeURIComponent(String(params.alias))];
        return roomId
          ? HttpResponse.json({ room_id: roomId, servers: ["h.example"] })
          : HttpResponse.json({ errcode: "M_NOT_FOUND", error: "no alias" }, { status: 404 });
      }),
      // The alias can resolve before sync has delivered the room, so the
      // client joins it; the joined room then arrives via sync.
      http.post(`${HS}/_matrix/client/v3/join/:alias`, ({ params }) =>
        HttpResponse.json({ room_id: aliases[decodeURIComponent(String(params.alias))] }),
      ),
    );
    localStorage.setItem(
      "zoon:session",
      JSON.stringify({ homeserverUrl: HS, accessToken: "tok", userId: me, deviceId: "DEV1" }),
    );
  });
  afterEach(() => {
    MatrixClientPeg.reset();
    localStorage.clear();
  });

  const switcherLabel = () => screen.getByRole("button", { name: /switch space/i });

  async function renderWith(workforceSpace: string | undefined, rooms = [
    space("!dev:h.example", "Dev"),
    space("!ops:h.example", "Ops"),
    space("!eng:h.example", "Eng"),
  ]) {
    stubSyncWithRooms(HS, rooms);
    render(<App config={{ homeserverUrl: HS, workforceSpace }} />);
    await waitFor(() => expect(screen.getByTestId("logged-in-view")).toBeInTheDocument());
  }

  it("defaults to #dev when workforce_space is omitted", async () => {
    await renderWith(undefined);
    await waitFor(() => expect(switcherLabel()).toHaveTextContent("Dev"));
  });

  it("selects the configured space", async () => {
    await renderWith("ops");
    await waitFor(() => expect(switcherLabel()).toHaveTextContent("Ops"));
  });

  it("serves different spaces from the same app with different runtime config", async () => {
    await renderWith("ops");
    await waitFor(() => expect(switcherLabel()).toHaveTextContent("Ops"));
    cleanup();
    MatrixClientPeg.reset();
    localStorage.setItem(
      "zoon:session",
      JSON.stringify({ homeserverUrl: HS, accessToken: "tok", userId: me, deviceId: "DEV1" }),
    );
    await renderWith("eng");
    await waitFor(() => expect(switcherLabel()).toHaveTextContent("Eng"));
  });

  it("falls back to the sole joined space when the configured alias doesn't resolve", async () => {
    await renderWith("missing", [space("!ops:h.example", "Ops")]);
    await waitFor(() => expect(switcherLabel()).toHaveTextContent("Ops"));
  });

  it("falls back to the sole joined space when the value is invalid", async () => {
    await renderWith("#ops:h.example", [space("!eng:h.example", "Eng")]);
    await waitFor(() => expect(switcherLabel()).toHaveTextContent("Eng"));
  });

  it("falls back to Home when unresolved and several spaces are joined", async () => {
    await renderWith("missing");
    await waitFor(() => expect(switcherLabel()).toHaveTextContent(/home/i));
  });

  it("falls back to Home when the value is invalid and several spaces are joined", async () => {
    await renderWith("a b");
    await waitFor(() => expect(switcherLabel()).toHaveTextContent(/home/i));
  });
});
