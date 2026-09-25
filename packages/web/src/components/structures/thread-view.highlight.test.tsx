import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import { makeFakeClient, makeMatrixEvent, makeRoom, pushTimelineEvent } from "../../../test/factories";
import { ThreadView } from "./thread-view";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

function seed() {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  (client as unknown as Record<string, unknown>).getRoom = () => room;
  MatrixClientPeg.injectClientForTest(client);
  pushTimelineEvent(room, makeMatrixEvent({
    eventId: "$root", roomId, sender: "@a:h.example", type: "m.room.message",
    content: { msgtype: "m.text", body: "root" },
  }));
  for (const id of ["$r1", "$r2"]) {
    pushTimelineEvent(room, makeMatrixEvent({
      eventId: id, roomId, sender: "@a:h.example", type: "m.room.message",
      content: { msgtype: "m.text", body: id, "m.relates_to": { rel_type: "m.thread", event_id: "$root" } },
    }));
  }
}

describe("<ThreadView highlightEventId />", () => {
  it("scrolls to and highlights the linked reply", () => {
    seed();
    const spy = vi.spyOn(Element.prototype, "scrollIntoView");
    const { container } = render(
      <ThreadView roomId={roomId} rootEventId="$root" onBack={() => {}} highlightEventId="$r1" />,
    );
    const el = container.querySelector('[data-event-id="$r1"]');
    expect(el).toHaveAttribute("data-highlighted");
    expect(container.querySelector('[data-event-id="$r2"]')).not.toHaveAttribute("data-highlighted");
    expect(spy).toHaveBeenCalled();
  });

  it("opens at the top quietly when the reply isn't loaded", () => {
    seed();
    const { container } = render(
      <ThreadView roomId={roomId} rootEventId="$root" onBack={() => {}} highlightEventId="$missing" />,
    );
    expect(container.querySelector("[data-highlighted]")).toBeNull();
  });
});
