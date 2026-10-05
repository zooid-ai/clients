import { act, renderHook } from "@testing-library/react";
import { MatrixEvent, RoomMember, RoomMemberEvent } from "matrix-js-sdk";
import { afterEach, describe, expect, it } from "vitest";
import { makeFakeClient, makeRoom } from "../../test/factories";
import { MatrixClientPeg } from "../client/peg";
import { useTyping } from "./use-typing";

const me = "@me:h.example";
const agent = "@architect.acme:h.example";
const roomId = "!r:h.example";

afterEach(() => MatrixClientPeg.reset());

describe("useTyping", () => {
  it("returns empty when nobody is typing", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    (room.currentState as unknown as { getMembers: () => RoomMember[] }).getMembers = () => [];
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useTyping(roomId));
    expect(result.current).toEqual([]);
  });

  it("returns typing user IDs excluding local user", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    const agentMember = new RoomMember(roomId, agent);
    const selfMember = new RoomMember(roomId, me);
    agentMember.typing = true;
    selfMember.typing = true;
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    (room.currentState as unknown as { getMembers: () => RoomMember[] }).getMembers = () => [
      agentMember,
      selfMember,
    ];
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useTyping(roomId));
    expect(result.current).toEqual([agent]);
  });

  it("updates when RoomMemberEvent.Typing fires", async () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    const agentMember = new RoomMember(roomId, agent);
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    (room.currentState as unknown as { getMembers: () => RoomMember[] }).getMembers = () => [
      agentMember,
    ];
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useTyping(roomId));
    expect(result.current).toEqual([]);
    act(() => {
      agentMember.typing = true;
      (client as unknown as { emit: (...a: unknown[]) => void }).emit(
        RoomMemberEvent.Typing,
        agentMember,
        room,
      );
    });
    expect(result.current).toEqual([agent]);
  });
});

function typingEvent(userIds: string[]): MatrixEvent {
  return new MatrixEvent({ type: "m.typing", room_id: roomId, content: { user_ids: userIds } });
}

describe("useTyping — the client never invents typing (ZOD091)", () => {
  function setup() {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(roomId, { client, myUserId: me });
    const agentMember = new RoomMember(roomId, agent);
    (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
    (room.currentState as unknown as { getMembers: () => RoomMember[] }).getMembers = () => [agentMember];
    MatrixClientPeg.injectClientForTest(client);
    // Real client re-emits member events; mirror that.
    agentMember.on(RoomMemberEvent.Typing, (ev, m) =>
      (client as unknown as { emit: (...a: unknown[]) => void }).emit(RoomMemberEvent.Typing, ev, m),
    );
    return { agentMember };
  }

  it("shows a member exactly while the last m.typing lists them", () => {
    const { agentMember } = setup();
    const { result } = renderHook(() => useTyping(roomId));
    expect(result.current).toEqual([]);
    act(() => agentMember.setTypingEvent(typingEvent([agent])));
    expect(result.current).toEqual([agent]);
    act(() => agentMember.setTypingEvent(typingEvent([])));
    expect(result.current).toEqual([]);
  });

  it("clears on the homeserver's lease-expiry m.typing, which carries no timeout of its own", () => {
    const { agentMember } = setup();
    const { result } = renderHook(() => useTyping(roomId));
    act(() => agentMember.setTypingEvent(typingEvent([agent, "@someone:h.example"])));
    expect(result.current).toEqual([agent]);
    // Server-side expiry is just a new m.typing without the agent.
    act(() => agentMember.setTypingEvent(typingEvent(["@someone:h.example"])));
    expect(result.current).toEqual([]);
  });
});
