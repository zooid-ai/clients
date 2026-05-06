import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app";
import { MatrixClientPeg } from "../../client/peg";
import {
  mswServer,
  relaxUnhandled,
  stubStartClient,
  stubSyncWithRooms,
} from "../../../test/setup";

const HS = "https://h.example";
const me = "@me:h.example";
const roomId = "!r:h.example";

describe("approval card integration", () => {
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

  it("renders Allow/Cancel and sends eco.zoon.approval_response on click", async () => {
    stubSyncWithRooms(HS, [
      {
        roomId,
        myUserId: me,
        state: [{ type: "m.room.name", sender: me, stateKey: "", content: { name: "alpha" } }],
        timeline: [
          {
            type: "eco.zoon.approval_request",
            sender: "@architect.acme:h.example",
            content: {
              approval_id: "a1",
              session_id: "s1",
              tool_call_id: "tc1",
            },
            eventId: "$req1",
          },
        ],
      },
    ]);
    const sendCalls: unknown[] = [];
    mswServer.use(
      http.put(
        `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/eco.zoon.approval_response/:txnId`,
        async ({ request }) => {
          sendCalls.push(await request.json());
          return HttpResponse.json({ event_id: "$resp1" });
        },
      ),
    );
    render(<App config={{ homeserverUrl: HS }} initialRoute={`/room/${roomId}`} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /allow/i }));
    await waitFor(() => expect(sendCalls).toHaveLength(1));
    expect(sendCalls[0]).toEqual({ approval_id: "a1", session_id: "s1", decision: "allow" });
  });
});
