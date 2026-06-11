import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import {
  makeFakeClient,
  makeMatrixEvent,
  makeRoom,
  pushTimelineEvent,
} from "../../test/factories";
import { useEditedContent } from "./use-edited-content";

const roomId = "!r:h.example";
const me = "@me:h.example";
const targetId = "$orig";

afterEach(() => MatrixClientPeg.reset());

function setup() {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = () => room;
  MatrixClientPeg.injectClientForTest(client);
  pushTimelineEvent(
    room,
    makeMatrixEvent({
      eventId: targetId,
      roomId,
      sender: "@alice:h.example",
      type: "m.room.message",
      content: { msgtype: "m.text", body: "helo" },
    }),
  );
  return { client, room };
}

function pushEdit(room: ReturnType<typeof makeRoom>, body: string, eventId = "$e1") {
  pushTimelineEvent(
    room,
    makeMatrixEvent({
      eventId,
      roomId,
      sender: "@alice:h.example",
      type: "m.room.message",
      content: {
        msgtype: "m.text",
        body: `* ${body}`,
        "m.new_content": { msgtype: "m.text", body },
        "m.relates_to": { rel_type: "m.replace", event_id: targetId },
      },
    }),
  );
}

describe("useEditedContent", () => {
  it("returns null for an unedited event", () => {
    setup();
    const { result } = renderHook(() => useEditedContent(roomId, targetId));
    expect(result.current).toBeNull();
  });

  it("returns the edited content after an m.replace arrives", () => {
    const { room } = setup();
    const { result } = renderHook(() => useEditedContent(roomId, targetId));
    act(() => pushEdit(room, "hello"));
    expect(result.current?.body).toBe("hello");
  });

  it("returns a referentially stable snapshot between renders", () => {
    const { room } = setup();
    pushEdit(room, "hello");
    const { result, rerender } = renderHook(() => useEditedContent(roomId, targetId));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
