import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app";
import { MatrixClientPeg } from "../../client/peg";
import { relaxUnhandled, stubStartClient, stubSyncWithRooms } from "../../../test/setup";

const HS = "https://h.example";
const me = "@me:h.example";
const roomId = "!a:h.example";

describe("<TimelinePanel />", () => {
  beforeEach(() => {
    localStorage.setItem(
      "zoon:session",
      JSON.stringify({ homeserverUrl: HS, accessToken: "tok", userId: me, deviceId: "DEV1" }),
    );
    relaxUnhandled();
    stubStartClient(HS);
  });
  afterEach(() => {
    MatrixClientPeg.reset();
    localStorage.clear();
  });

  it("renders m.room.message events as plain text", async () => {
    stubSyncWithRooms(HS, [
      {
        roomId,
        myUserId: me,
        state: [{ type: "m.room.name", sender: me, stateKey: "", content: { name: "alpha" } }],
        timeline: [
          {
            type: "m.room.message",
            sender: "@me:h.example",
            content: { msgtype: "m.text", body: "hello world" },
          },
        ],
      },
    ]);
    render(<App config={{ homeserverUrl: HS }} initialRoute={`/room/${roomId}`} />);
    await waitFor(() => expect(screen.getByText("hello world")).toBeInTheDocument());
  });

  it("renders eco.zoon.message_chunk events with their content", async () => {
    stubSyncWithRooms(HS, [
      {
        roomId,
        myUserId: me,
        state: [{ type: "m.room.name", sender: me, stateKey: "", content: { name: "alpha" } }],
        timeline: [
          {
            type: "eco.zoon.message_chunk",
            sender: "@architect.acme:h.example",
            content: { session_id: "s1", content: "agent thinking…" },
          },
        ],
      },
    ]);
    render(<App config={{ homeserverUrl: HS }} initialRoute={`/room/${roomId}`} />);
    await waitFor(() => expect(screen.getByText("agent thinking…")).toBeInTheDocument());
  });

  it("renders eco.zoon.tool_call as a (placeholder) collapsible card", async () => {
    stubSyncWithRooms(HS, [
      {
        roomId,
        myUserId: me,
        state: [{ type: "m.room.name", sender: me, stateKey: "", content: { name: "alpha" } }],
        timeline: [
          {
            type: "eco.zoon.tool_call",
            sender: "@architect.acme:h.example",
            content: { session_id: "s1", tool_call_id: "tc1", title: "Bash", kind: "execute" },
          },
        ],
      },
    ]);
    render(<App config={{ homeserverUrl: HS }} initialRoute={`/room/${roomId}`} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /bash/i })).toBeInTheDocument(),
    );
  });

  it("does not render unknown eco.zoon.* events (forward-compat)", async () => {
    stubSyncWithRooms(HS, [
      {
        roomId,
        myUserId: me,
        state: [{ type: "m.room.name", sender: me, stateKey: "", content: { name: "alpha" } }],
        timeline: [
          {
            type: "eco.zoon.future_event",
            sender: "@architect.acme:h.example",
            content: { session_id: "s1" },
          },
          {
            type: "m.room.message",
            sender: "@me:h.example",
            content: { msgtype: "m.text", body: "after the unknown" },
          },
        ],
      },
    ]);
    render(<App config={{ homeserverUrl: HS }} initialRoute={`/room/${roomId}`} />);
    await waitFor(() => expect(screen.getByText("after the unknown")).toBeInTheDocument());
    expect(screen.queryByText(/future_event/i)).not.toBeInTheDocument();
  });
});
