import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { Composer } from "./composer";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => {
  cleanup();
  MatrixClientPeg.reset();
});

function setup() {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
  (client as unknown as { sendEvent: unknown }).sendEvent = vi.fn().mockResolvedValue({ event_id: "$m1" });
  MatrixClientPeg.injectClientForTest(client);
  return { room };
}

describe("command palette", () => {
  it("lists advertised commands in the / dropdown, tagged as agent", async () => {
    const { room } = setup();
    act(() => {
      pushTimelineEvent(
        room,
        mkMatrixEvent({
          roomId,
          sender: "@agent:h.example",
          type: "eco.zoon.available_commands_update",
          content: {
            session_id: "s1",
            available_commands: [{ name: "plan", description: "Switch to plan mode" }],
          },
        }),
      );
    });

    render(<Composer roomId={roomId} threadRootEventId="$root" />);
    const textarea = screen.getByLabelText("Message");
    fireEvent.change(textarea, { target: { value: "/" } });

    // client commands still present
    expect(await screen.findByText("/clear")).toBeInTheDocument();
    // advertised agent command is present
    expect(screen.getByText("/plan")).toBeInTheDocument();
    const planOption = screen.getByText("/plan").closest('[role="option"]')!;
    expect(planOption).toHaveTextContent(/agent/i);
  });
});
