import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "@/client/peg";
import { makeFakeClient } from "../../../test/factories";
import { ProfileSettingsDialog } from "./profile-settings-dialog";

const me = "@me:h.example";

afterEach(() => MatrixClientPeg.reset());

function setup() {
  const client = makeFakeClient({ userId: me });
  const cast = client as unknown as Record<string, unknown>;
  cast.setDisplayName = vi.fn().mockResolvedValue({});
  cast.setAvatarUrl = vi.fn().mockResolvedValue({});
  cast.uploadContent = vi.fn().mockResolvedValue({ content_uri: "mxc://h.example/abc" });
  cast.getUser = () => ({ displayName: "Old Name", avatarUrl: null });
  MatrixClientPeg.injectClientForTest(client);
  return { client: cast };
}

describe("ProfileSettingsDialog", () => {
  it("saves a changed display name", async () => {
    const { client } = setup();
    render(<ProfileSettingsDialog open onOpenChange={() => {}} />);

    const input = screen.getByLabelText(/display name/i);
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(client.setDisplayName).toHaveBeenCalledWith("New Name"),
    );
  });

  it("uploads a selected avatar and sets the avatar url", async () => {
    const { client } = setup();
    render(<ProfileSettingsDialog open onOpenChange={() => {}} />);

    const file = new File(["png-bytes"], "me.png", { type: "image/png" });
    const fileInput = screen.getByLabelText(/avatar/i);
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(client.uploadContent).toHaveBeenCalledWith(file);
      expect(client.setAvatarUrl).toHaveBeenCalledWith("mxc://h.example/abc");
    });
  });

  it("does not call the profile API when nothing changed", async () => {
    const { client } = setup();
    render(<ProfileSettingsDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => {
      expect(client.setDisplayName).not.toHaveBeenCalled();
      expect(client.setAvatarUrl).not.toHaveBeenCalled();
    });
  });
});
