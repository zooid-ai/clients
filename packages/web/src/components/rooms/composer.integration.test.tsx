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

describe("composer integration", () => {
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

  it("typing + Enter sends an m.room.message", async () => {
    stubSyncWithRooms(HS, [
      {
        roomId,
        myUserId: me,
        state: [{ type: "m.room.name", sender: me, stateKey: "", content: { name: "alpha" } }],
      },
    ]);
    const sendCalls: unknown[] = [];
    mswServer.use(
      http.put(
        `${HS}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/:txnId`,
        async ({ request }) => {
          sendCalls.push(await request.json());
          return HttpResponse.json({ event_id: "$m1" });
        },
      ),
    );
    render(<App config={{ homeserverUrl: HS }} initialRoute={`/room/${roomId}`} />);
    const user = userEvent.setup();
    const input = await screen.findByRole("textbox", { name: /message/i });
    await user.type(input, "hi from me{Enter}");
    await waitFor(() => expect(sendCalls).toHaveLength(1));
    expect(sendCalls[0]).toMatchObject({ msgtype: "m.text", body: "hi from me" });
  });
});
