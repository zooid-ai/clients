import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConditionKind, PushRuleActionName } from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";
import { makePushClient } from "@/lib/matrix/notification-prefs.test";
import { makeRoom } from "../../../test/factories";
import { RoomHeader } from "./room-header";

const roomId = "!r:h.example";
const me = "@me:h.example";

function setupClient() {
  const client = makePushClient();
  const room = makeRoom(roomId, { client, myUserId: me });
  (client as unknown as Record<string, unknown>).getRoom = () => room;
  (client as unknown as Record<string, unknown>).getUser = () => null;
  MatrixClientPeg.injectClientForTest(client);
  return client;
}

afterEach(() => {
  MatrixClientPeg.reset();
  vi.restoreAllMocks();
});

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomHeader />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("room header notifications", () => {
  it("shows a muted indicator when the room is muted", () => {
    const client = setupClient();
    (client as unknown as Record<string, unknown>).pushRules = {
      global: {
        override: [
          {
            rule_id: roomId,
            default: false,
            enabled: true,
            conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomId }],
            actions: [PushRuleActionName.DontNotify],
          },
        ],
        content: [],
        room: [],
        sender: [],
        underride: [],
      },
    };
    renderHeader();
    expect(screen.getByLabelText(/muted/i)).toBeInTheDocument();
  });
});
