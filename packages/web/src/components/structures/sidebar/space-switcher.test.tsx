import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient, makeRoom } from "../../../../test/factories";
import { MatrixClientPeg } from "../../../client/peg";
import { SpaceSwitcher } from "./space-switcher";
import type { Scope } from "./scope";

const me = "@me:h.example";

afterEach(() => MatrixClientPeg.reset());

function seedSpaces() {
  const client = makeFakeClient({ userId: me });
  const dev = makeRoom("!dev:h.example", { client, myUserId: me });
  (dev as unknown as { name: string; isSpaceRoom: () => boolean }).name = "Dev";
  (dev as unknown as { isSpaceRoom: () => boolean }).isSpaceRoom = () => true;
  (client as unknown as { getRooms: () => unknown[] }).getRooms = () => [dev];
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) =>
    id === "!dev:h.example" ? dev : null;
  MatrixClientPeg.injectClientForTest(client);
}

describe("<SpaceSwitcher>", () => {
  it("shows the active space name as the trigger label", () => {
    seedSpaces();
    const scope: Scope = { kind: "space", spaceId: "!dev:h.example" };
    render(<SpaceSwitcher scope={scope} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /switch space/i })).toHaveTextContent("Dev");
  });

  it("shows Home as the trigger label in home scope", () => {
    seedSpaces();
    render(<SpaceSwitcher scope={{ kind: "home" }} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /switch space/i })).toHaveTextContent(/home/i);
  });

  it("lists Home plus each joined space and selects one", async () => {
    seedSpaces();
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SpaceSwitcher scope={{ kind: "home" }} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /switch space/i }));
    expect(await screen.findByRole("menuitem", { name: /home/i })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Dev" }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "space", spaceId: "!dev:h.example" });
  });

  it("selects Home from a space scope", async () => {
    seedSpaces();
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SpaceSwitcher scope={{ kind: "space", spaceId: "!dev:h.example" }} onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: /switch space/i }));
    await user.click(await screen.findByRole("menuitem", { name: /home/i }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "home" });
  });
});
