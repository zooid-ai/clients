import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { RenameRoomDialog } from "./rename-room";

const clientRef: { current: { setRoomName: ReturnType<typeof vi.fn> } } = {
  current: { setRoomName: vi.fn(async () => ({ event_id: "$ev" })) },
};

vi.mock("../../client/peg", () => ({
  MatrixClientPeg: { safeGet: () => clientRef.current },
}));

beforeEach(() => {
  clientRef.current = { setRoomName: vi.fn(async () => ({ event_id: "$ev" })) };
});
afterEach(cleanup);

describe("<RenameRoomDialog />", () => {
  it("pre-fills the current room name and submits a new name via setRoomName", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <RenameRoomDialog
        open
        roomId="!r:localhost"
        currentName="welcome"
        onOpenChange={onOpenChange}
      />,
    );
    const input = (await screen.findByLabelText(/room name/i)) as HTMLInputElement;
    expect(input.value).toBe("welcome");
    await user.clear(input);
    await user.type(input, "Welcome Aboard");
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => {
      expect(clientRef.current.setRoomName).toHaveBeenCalledWith(
        "!r:localhost",
        "Welcome Aboard",
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an error when setRoomName rejects", async () => {
    clientRef.current = {
      setRoomName: vi.fn(async () => {
        throw new Error("M_FORBIDDEN: not allowed");
      }),
    };
    const user = userEvent.setup();
    render(
      <RenameRoomDialog
        open
        roomId="!r:localhost"
        currentName="welcome"
        onOpenChange={() => {}}
      />,
    );
    const input = await screen.findByLabelText(/room name/i);
    await user.clear(input);
    await user.type(input, "Welcome Aboard");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/forbidden|not allowed/i);
  });

  it("disables save when the trimmed value is empty", async () => {
    const user = userEvent.setup();
    render(
      <RenameRoomDialog
        open
        roomId="!r:localhost"
        currentName="welcome"
        onOpenChange={() => {}}
      />,
    );
    const input = await screen.findByLabelText(/room name/i);
    await user.clear(input);
    await user.type(input, "   ");
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("disables save when the value is unchanged", async () => {
    render(
      <RenameRoomDialog
        open
        roomId="!r:localhost"
        currentName="welcome"
        onOpenChange={() => {}}
      />,
    );
    expect(await screen.findByRole("button", { name: /save/i })).toBeDisabled();
  });
});
