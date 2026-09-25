import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import type { QuoteRef } from "@/lib/matrix/quote";
import { makeFakeClient, makeMatrixEvent, makeRoom, pushTimelineEvent } from "../../../test/factories";
import { QuoteCard } from "./quote-card";

const me = "@me:h.example";
const here = "!here:h.example";
const src = "!src:h.example";

const quote: QuoteRef = {
  room_id: src,
  event_id: "$q",
  thread_id: "$q",
  sender: "@coding:h.example",
  origin_server_ts: Date.UTC(2026, 8, 25, 14, 42),
  snapshot: { msgtype: "m.text", body: "snapshot text" },
};

function Probe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function renderCard(q: QuoteRef, currentRoomId = here) {
  return render(
    <MemoryRouter initialEntries={[`/room/${here}`]}>
      <Routes>
        <Route path="*" element={<><QuoteCard quote={q} currentRoomId={currentRoomId} /><Probe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => MatrixClientPeg.reset());

describe("<QuoteCard />", () => {
  it("renders the snapshot when the source room is unknown, labelled as another room", () => {
    MatrixClientPeg.injectClientForTest(makeFakeClient({ userId: me }));
    renderCard(quote);
    expect(screen.getByText("snapshot text")).toBeInTheDocument();
    expect(screen.getByText(/in another room/i)).toBeInTheDocument();
  });

  it("prefers the live source and names its room", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(src, { client, myUserId: me });
    room.name = "backend";
    (client as unknown as { addRoom(r: unknown): void }).addRoom(room);
    pushTimelineEvent(
      room,
      makeMatrixEvent({
        eventId: "$q",
        roomId: src,
        sender: "@coding:h.example",
        type: "m.room.message",
        content: { msgtype: "m.text", body: "live text" },
      }),
    );
    MatrixClientPeg.injectClientForTest(client);
    renderCard(quote);
    expect(screen.getByText("live text")).toBeInTheDocument();
    expect(screen.queryByText("snapshot text")).toBeNull();
    expect(screen.getByText(/in backend/i)).toBeInTheDocument();
  });

  it("shows a deleted source as deleted", () => {
    const client = makeFakeClient({ userId: me });
    const room = makeRoom(src, { client, myUserId: me });
    (client as unknown as { addRoom(r: unknown): void }).addRoom(room);
    const ev = makeMatrixEvent({
      eventId: "$q",
      roomId: src,
      sender: "@coding:h.example",
      type: "m.room.message",
      content: { msgtype: "m.text", body: "gone" },
    });
    (ev as unknown as { isRedacted: () => boolean }).isRedacted = () => true;
    pushTimelineEvent(room, ev);
    MatrixClientPeg.injectClientForTest(client);
    renderCard(quote);
    expect(screen.getByText(/original message deleted/i)).toBeInTheDocument();
  });

  it("omits the room label for a same-room quote and shows the reply count", () => {
    MatrixClientPeg.injectClientForTest(makeFakeClient({ userId: me }));
    renderCard({ ...quote, thread: { reply_count: 12 } }, src);
    expect(screen.queryByText(/^in /i)).toBeNull();
    expect(screen.getByText(/12 replies · View thread/)).toBeInTheDocument();
  });

  it("navigates to the source thread on click", async () => {
    MatrixClientPeg.injectClientForTest(makeFakeClient({ userId: me }));
    renderCard({ ...quote, event_id: "$reply", thread_id: "$root" });
    await userEvent.setup().click(screen.getByRole("link", { name: /quoted message/i }));
    expect(screen.getByTestId("loc")).toHaveTextContent(
      "/room/!src%3Ah.example?thread=%24root&event=%24reply",
    );
  });
});
