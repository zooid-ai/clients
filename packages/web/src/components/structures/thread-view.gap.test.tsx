import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { ThreadView } from "./thread-view";

const me = "@me:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

function seed(rootId: string, { gappy }: { gappy: boolean }) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me, timelineSupport: true });
  const paginate = vi.fn().mockResolvedValue(true);
  Object.assign(client as unknown as Record<string, unknown>, {
    getRoom: () => room,
    paginateEventTimeline: paginate,
  });
  MatrixClientPeg.injectClientForTest(client);
  const push = (eventId: string, ts: number, thread: boolean) =>
    pushTimelineEvent(
      room,
      mkMatrixEvent({
        eventId,
        roomId,
        sender: "@a:h.example",
        type: "m.room.message",
        content: {
          msgtype: "m.text",
          body: eventId,
          ...(thread ? { "m.relates_to": { rel_type: "m.thread", event_id: rootId } } : {}),
        },
        ts,
      }),
    );
  push(rootId, 1000, false);
  push(`${rootId}-r1`, 1100, true);
  if (gappy) room.resetLiveTimeline("hole_tok", "old_sync_tok");
  push(`${rootId}-r2`, 3000, true);
  return { room, paginate };
}

describe("<ThreadView /> gap marker", () => {
  it("renders the marker between the two loaded stretches of the thread", () => {
    seed("$g1", { gappy: true });
    const { container } = render(<ThreadView roomId={roomId} rootEventId="$g1" onBack={() => {}} />);

    const gap = screen.getByTestId("timeline-gap");
    const r1 = container.querySelector('[data-event-id="$g1-r1"]')!;
    const r2 = container.querySelector('[data-event-id="$g1-r2"]')!;
    expect(r1.compareDocumentPosition(gap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(gap.compareDocumentPosition(r2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("fills the hole from the marker by paginating the timeline after it", async () => {
    const { room, paginate } = seed("$g2", { gappy: true });
    render(<ThreadView roomId={roomId} rootEventId="$g2" onBack={() => {}} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /load missing messages/i }));
    });

    const [, newer] = room.getUnfilteredTimelineSet().getTimelines();
    expect(paginate).toHaveBeenCalledWith(newer, { backwards: true, limit: 50 });
  });

  it("renders no marker for a contiguous thread", () => {
    seed("$g3", { gappy: false });
    render(<ThreadView roomId={roomId} rootEventId="$g3" onBack={() => {}} />);
    expect(screen.queryByTestId("timeline-gap")).toBeNull();
  });
});
