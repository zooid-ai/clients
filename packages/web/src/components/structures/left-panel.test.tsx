import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app";
import { MatrixClientPeg } from "../../client/peg";
import { mswServer, relaxUnhandled, stubStartClient, stubSyncWithRooms } from "../../../test/setup";

const HS = "https://h.example";
const me = "@me:h.example";
const SPACE = "!space:h.example";

function stubWorkforceSpace() {
  mswServer.use(
    http.get(`${HS}/_matrix/client/v3/directory/room/${encodeURIComponent("#dev:h.example")}`, () =>
      HttpResponse.json({ room_id: SPACE }),
    ),
    http.post(`${HS}/_matrix/client/v3/join/${encodeURIComponent("#dev:h.example")}`, () =>
      HttpResponse.json({ room_id: SPACE }),
    ),
  );
}

describe("<LeftPanel />", () => {
  beforeEach(() => {
    localStorage.setItem(
      "zoon:session",
      JSON.stringify({ homeserverUrl: HS, accessToken: "tok", userId: me, deviceId: "DEV1" }),
    );
    relaxUnhandled();
    stubStartClient(HS);
    stubWorkforceSpace();
  });
  afterEach(() => {
    MatrixClientPeg.reset();
    localStorage.clear();
  });

  it("lists rooms returned by /sync as space children", async () => {
    stubSyncWithRooms(HS, [
      {
        roomId: SPACE,
        myUserId: me,
        state: [
          {
            type: "m.space.child",
            sender: me,
            stateKey: "!a:h.example",
            content: { via: ["h.example"] },
          },
          {
            type: "m.space.child",
            sender: me,
            stateKey: "!b:h.example",
            content: { via: ["h.example"] },
          },
        ],
      },
      {
        roomId: "!a:h.example",
        myUserId: me,
        state: [{ type: "m.room.name", sender: me, stateKey: "", content: { name: "alpha" } }],
      },
      {
        roomId: "!b:h.example",
        myUserId: me,
        state: [{ type: "m.room.name", sender: me, stateKey: "", content: { name: "beta" } }],
      },
    ]);
    render(<App config={{ homeserverUrl: HS }} />);
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("clicking a room navigates to /room/:roomId and renders the timeline", async () => {
    stubSyncWithRooms(HS, [
      {
        roomId: SPACE,
        myUserId: me,
        state: [
          {
            type: "m.space.child",
            sender: me,
            stateKey: "!a:h.example",
            content: { via: ["h.example"] },
          },
        ],
      },
      {
        roomId: "!a:h.example",
        myUserId: me,
        state: [{ type: "m.room.name", sender: me, stateKey: "", content: { name: "alpha" } }],
        timeline: [
          {
            type: "m.room.message",
            sender: "@architect.acme:h.example",
            content: { msgtype: "m.text", body: "hi from architect" },
          },
        ],
      },
    ]);
    render(<App config={{ homeserverUrl: HS }} />);
    const user = userEvent.setup();
    await user.click(await screen.findByText("alpha"));
    expect(await screen.findByText("hi from architect")).toBeInTheDocument();
  });
});
