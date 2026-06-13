import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { RoomIntro } from "./room-intro";

vi.mock("@dicebear/core", () => ({ createAvatar: vi.fn().mockReturnValue({ toDataUri: () => "data:image/svg+xml,mock" }) }));
vi.mock("@dicebear/collection", () => ({ shapes: {} }));

const me = "@me:h.example";
const roomId = "!r:h.example";
afterEach(() => MatrixClientPeg.reset());

it("renders the room name and topic at the start of the room", () => {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  Object.assign(room as unknown as Record<string, unknown>, { name: "dev", getMxcAvatarUrl: () => null });
  injectStateEvent(room, mkMatrixEvent({ roomId, sender: "@a:h.example", type: "m.room.topic", stateKey: "", content: { topic: "ship the daemon" } }));
  Object.assign(client as unknown as Record<string, unknown>, { getRoom: () => room, mxcUrlToHttp: () => "" });
  MatrixClientPeg.injectClientForTest(client);
  render(<RoomIntro roomId={roomId} />);
  expect(screen.getByText(/start of/i)).toBeInTheDocument();
  expect(screen.getByText("dev")).toBeInTheDocument();
  expect(screen.getByText("ship the daemon")).toBeInTheDocument();
});
