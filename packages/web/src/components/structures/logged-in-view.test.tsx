import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app";
import { MatrixClientPeg } from "../../client/peg";
import { relaxUnhandled, stubStartClient } from "../../../test/setup";

const HS = "https://h.example";
const me = "@alice:h.example";

describe("<LoggedInView /> sidebar polish", () => {
  beforeEach(() => {
    relaxUnhandled();
    stubStartClient(HS);
    localStorage.setItem(
      "zoon:session",
      JSON.stringify({
        homeserverUrl: HS,
        accessToken: "tok",
        userId: me,
        deviceId: "DEV1",
      }),
    );
  });
  afterEach(() => {
    MatrixClientPeg.reset();
    localStorage.clear();
  });

  it("renders a room sidebar with a 'Rooms' header", async () => {
    render(<App config={{ homeserverUrl: HS }} />);
    await waitFor(() =>
      expect(screen.getByTestId("logged-in-view")).toBeInTheDocument(),
    );
    expect(document.querySelector('[data-slot="sidebar"]')).not.toBeNull();
    // Header text is rendered inside SidebarHeader.
    expect(screen.getByText(/^rooms$/i)).toBeInTheDocument();
  });

  it("toggles the sidebar with Cmd-B / Ctrl-B", async () => {
    const user = userEvent.setup();
    render(<App config={{ homeserverUrl: HS }} />);
    await waitFor(() =>
      expect(screen.getByTestId("logged-in-view")).toBeInTheDocument(),
    );
    const sidebar = document.querySelector('[data-slot="sidebar"]') as HTMLElement;
    expect(sidebar).not.toBeNull();
    expect(sidebar.getAttribute("data-state")).toBe("expanded");

    await user.keyboard("{Meta>}b{/Meta}");
    await waitFor(() => expect(sidebar.getAttribute("data-state")).toBe("collapsed"));

    await user.keyboard("{Meta>}b{/Meta}");
    await waitFor(() => expect(sidebar.getAttribute("data-state")).toBe("expanded"));
  });
});
