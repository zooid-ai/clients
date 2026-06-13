import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { injectStateEvent, makeFakeClient, makeRoom, mkMatrixEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { RoomPanel } from "./room-panel";

const { notifSetState } = vi.hoisted(() => ({ notifSetState: vi.fn() }));
vi.mock("../../hooks/use-room-notif-state", () => ({
  useRoomNotifState: () => ({ state: "all", setState: notifSetState }),
}));

const me = "@me:h.example";
const roomId = "!r:h.example";
afterEach(() => {
  MatrixClientPeg.reset();
  vi.restoreAllMocks();
  notifSetState.mockReset();
});

function setup(myPL: number) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me, powerLevels: { [me]: myPL } });
  Object.assign(room as unknown as Record<string, unknown>, {
    name: "Design",
    getJoinedMemberCount: () => 4,
    getMxcAvatarUrl: () => null,
    getCanonicalAlias: () => "#design:h.example",
  });
  injectStateEvent(room, mkMatrixEvent({ roomId, sender: "@a:h.example", type: "m.room.topic", stateKey: "", content: { topic: "where we design" } }));
  injectStateEvent(room, mkMatrixEvent({ roomId, sender: "@a:h.example", type: "m.room.join_rules", stateKey: "", content: { join_rule: "invite" } }));
  injectStateEvent(room, mkMatrixEvent({ roomId, sender: "@a:h.example", type: "m.room.power_levels", stateKey: "", content: { users: { [me]: myPL }, state_default: 50 } }));
  const setRoomName = vi.fn().mockResolvedValue(undefined);
  const setRoomTopic = vi.fn().mockResolvedValue(undefined);
  const sendStateEvent = vi.fn().mockResolvedValue(undefined);
  const uploadContent = vi.fn().mockResolvedValue({ content_uri: "mxc://h.example/new" });
  const leave = vi.fn().mockResolvedValue(undefined);
  Object.assign(client as unknown as Record<string, unknown>, {
    getRoom: (id: string) => (id === roomId ? room : null),
    leave, setRoomName, setRoomTopic, sendStateEvent, uploadContent,
    mxcUrlToHttp: () => "",
  });
  MatrixClientPeg.injectClientForTest(client);
  return { setRoomName, setRoomTopic, sendStateEvent, uploadContent, leave };
}

function renderPanel(view: "home" | "people" | "notifications" = "home", onNavigate = vi.fn()) {
  render(
    <MemoryRouter>
      <RoomPanel roomId={roomId} spaceId="!space:h.example" view={view} onNavigate={onNavigate} onClose={() => {}} />
    </MemoryRouter>,
  );
  return { onNavigate };
}

describe("<RoomPanel /> — home", () => {
  it("displays name, alias, topic, join rule and member count", () => {
    setup(0);
    renderPanel("home");
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText("#design:h.example")).toBeInTheDocument();
    expect(screen.getByText("where we design")).toBeInTheDocument();
    expect(screen.getByText(/invite only/i)).toBeInTheDocument();
    expect(screen.getByText(/4 members/i)).toBeInTheDocument();
  });

  it("hides edit affordances below the required power level", () => {
    setup(0);
    renderPanel("home");
    expect(screen.queryByRole("button", { name: /edit (name|topic)/i })).toBeNull();
  });

  it("edits the topic when permitted", async () => {
    const { setRoomTopic } = setup(100);
    renderPanel("home");
    await userEvent.click(screen.getByRole("button", { name: /edit topic/i }));
    const box = screen.getByRole("textbox", { name: /topic/i });
    await userEvent.clear(box);
    await userEvent.type(box, "new topic");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(setRoomTopic).toHaveBeenCalledWith(roomId, "new topic");
  });

  it("uploads and sets a new avatar when permitted", async () => {
    const { uploadContent, sendStateEvent } = setup(100);
    renderPanel("home");
    const file = new File(["png"], "room.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/room avatar/i), file);
    expect(uploadContent).toHaveBeenCalled();
    expect(sendStateEvent).toHaveBeenCalledWith(roomId, "m.room.avatar", { url: "mxc://h.example/new" }, "");
  });

  it("leaves the room from the home", async () => {
    const { leave } = setup(0);
    renderPanel("home");
    await userEvent.click(screen.getByRole("button", { name: /leave room/i }));
    expect(leave).toHaveBeenCalledWith(roomId);
  });

  it("navigates to People and Notifications rows", async () => {
    setup(0);
    const { onNavigate } = renderPanel("home");
    await userEvent.click(screen.getByRole("button", { name: /people/i }));
    expect(onNavigate).toHaveBeenCalledWith("people");
    await userEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(onNavigate).toHaveBeenCalledWith("notifications");
  });
});

describe("<RoomPanel /> — sub-views", () => {
  it("Notifications sub-view changes the setting and can go back", async () => {
    setup(0);
    const { onNavigate } = renderPanel("notifications");
    await userEvent.click(screen.getByRole("radio", { name: /mute/i }));
    expect(notifSetState).toHaveBeenCalledWith("mute");
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onNavigate).toHaveBeenCalledWith("home");
  });

  it("People sub-view renders the member list and can go back", async () => {
    setup(0);
    const { onNavigate } = renderPanel("people");
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onNavigate).toHaveBeenCalledWith("home");
  });
});
