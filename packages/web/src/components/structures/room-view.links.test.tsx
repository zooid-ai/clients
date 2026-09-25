import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import { makeFakeClient, makeRoom } from "../../../test/factories";
import { RoomView } from "./room-view";

vi.mock("./thread-view", () => ({
  ThreadView: (p: { rootEventId: string; highlightEventId?: string }) => (
    <div data-testid="thread">{`${p.rootEventId}|${p.highlightEventId ?? ""}`}</div>
  ),
}));
vi.mock("./timeline-panel", () => ({ TimelinePanel: () => <div data-testid="timeline" /> }));
vi.mock("../rooms/composer", () => ({ Composer: () => <div data-testid="composer" /> }));
vi.mock("../rooms/typing-indicator", () => ({ TypingIndicator: () => null }));
vi.mock("../../hooks/use-mark-read", () => ({ useMarkRead: () => {} }));
vi.mock("../../hooks/use-typing", () => ({ useTyping: () => [] }));
vi.mock("../../hooks/use-plan", () => ({ usePlan: () => null }));

const me = "@me:h.example";
const roomId = "!r:h.example";

function Probe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/room/:roomId" element={<><RoomView /><Probe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => MatrixClientPeg.reset());

describe("RoomView link handling", () => {
  it("passes ?event= to ThreadView as the highlight", () => {
    const client = makeFakeClient({ userId: me });
    (client as unknown as { addRoom(r: unknown): void }).addRoom(makeRoom(roomId, { client, myUserId: me }));
    MatrixClientPeg.injectClientForTest(client);
    renderAt("/room/!r%3Ah.example?thread=%24root&event=%24reply");
    expect(screen.getByTestId("thread")).toHaveTextContent("$root|$reply");
  });

  it("shows the not-joined panel for an unknown room and joins, keeping the thread", async () => {
    const client = makeFakeClient({ userId: me });
    const joinRoom = vi.fn().mockImplementation(async () => {
      const room = makeRoom(roomId, { client, myUserId: me });
      (client as unknown as { addRoom(r: unknown): void }).addRoom(room);
      return room;
    });
    (client as unknown as Record<string, unknown>).joinRoom = joinRoom;
    MatrixClientPeg.injectClientForTest(client);
    renderAt("/room/!r%3Ah.example?thread=%24root");
    expect(screen.getByText(/you're not in this room/i)).toBeInTheDocument();
    expect(screen.queryByTestId("composer")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: /join room/i }));
    expect(joinRoom).toHaveBeenCalledWith(roomId);
    expect(await screen.findByTestId("thread")).toHaveTextContent("$root|");
    expect(screen.getByTestId("loc")).toHaveTextContent("thread=%24root");
  });

  it("says access is denied when the join fails", async () => {
    const client = makeFakeClient({ userId: me });
    (client as unknown as Record<string, unknown>).joinRoom = vi.fn().mockRejectedValue(new Error("M_FORBIDDEN"));
    MatrixClientPeg.injectClientForTest(client);
    renderAt("/room/!r%3Ah.example?thread=%24root");
    await userEvent.setup().click(screen.getByRole("button", { name: /join room/i }));
    expect(await screen.findByText(/you don't have access to this room/i)).toBeInTheDocument();
  });

  it("switches to the room when sync delivers it", () => {
    const client = makeFakeClient({ userId: me });
    MatrixClientPeg.injectClientForTest(client);
    renderAt("/room/!r%3Ah.example?thread=%24root");
    act(() =>
      (client as unknown as { addRoom(r: unknown): void }).addRoom(makeRoom(roomId, { client, myUserId: me })),
    );
    expect(screen.getByTestId("thread")).toBeInTheDocument();
  });
});
