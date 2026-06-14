import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { EcoZoonEventTile } from "./eco-zoon-event";
import { decodeEcoZoonEvent } from "../../events/eco-zoon";

const me = "@me:h.example";
const roomId = "!r:h.example";
afterEach(() => MatrixClientPeg.reset());

describe("ToolCallCard diff rendering", () => {
  it("renders a diff delivered on a tool_call_update", async () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    (client as unknown as { getRoom: (id: string) => unknown }).getRoom = () => room;
    MatrixClientPeg.injectClientForTest(client);

    const call = mkMatrixEvent({
      roomId,
      sender: "@agent:h.example",
      type: "eco.zoon.tool_call",
      content: { session_id: "s1", tool_call_id: "tc1", title: "Edit auth.ts", kind: "edit" },
    });
    pushTimelineEvent(room, call);
    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@agent:h.example",
          type: "eco.zoon.tool_call_update",
          content: {
            session_id: "s1",
            tool_call_id: "tc1",
            status: "completed",
            content: [{ type: "diff", path: "/repo/auth.ts", oldText: "a\n", newText: "b\n" }],
          },
        }),
      );
    });

    const decoded = decodeEcoZoonEvent(call)!;
    render(<EcoZoonEventTile decoded={decoded} sender="@agent:h.example" roomId={roomId} ts={Date.now()} />);
    screen.getByRole("button", { name: /Edit auth.ts/i }).click();
    expect(await screen.findByText("auth.ts")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
  });
});
