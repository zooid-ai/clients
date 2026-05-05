import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./app";
import { MatrixClientPeg } from "./client/peg";
import { mswServer, relaxUnhandled, stubStartClient } from "../test/setup";

const HS = "https://h.example";

describe("<App />", () => {
  beforeEach(() => {
    localStorage.clear();
    relaxUnhandled();
    stubStartClient(HS);
    mswServer.use(
      http.get(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({ flows: [{ type: "m.login.password" }] }),
      ),
    );
  });
  afterEach(() => {
    MatrixClientPeg.reset();
    localStorage.clear();
  });

  it("renders <Login /> when no session is in storage", async () => {
    render(<App config={{ homeserverUrl: HS }} />);
    expect(await screen.findByLabelText(/username/i)).toBeInTheDocument();
  });

  it("restores the session from storage and renders <LoggedInView />", async () => {
    localStorage.setItem(
      "zoon:session",
      JSON.stringify({
        homeserverUrl: HS,
        accessToken: "tok",
        userId: "@alice:h.example",
        deviceId: "DEV1",
      }),
    );
    render(<App config={{ homeserverUrl: HS }} />);
    await waitFor(() =>
      expect(screen.getByTestId("logged-in-view")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("logged-in-view")).toHaveTextContent("@alice:h.example");
  });

  it("clears storage and reroutes to /login on logout", async () => {
    localStorage.setItem(
      "zoon:session",
      JSON.stringify({
        homeserverUrl: HS,
        accessToken: "tok",
        userId: "@alice:h.example",
        deviceId: "DEV1",
      }),
    );
    mswServer.use(
      http.post(`${HS}/_matrix/client/v3/logout`, () => HttpResponse.json({})),
    );
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<App config={{ homeserverUrl: HS }} />);
    await waitFor(() => screen.getByTestId("logged-in-view"));
    await user.click(screen.getByRole("button", { name: /user menu/i }));
    await user.click(await screen.findByRole("menuitem", { name: /log out/i }));
    await waitFor(() => expect(screen.queryByTestId("logged-in-view")).toBeNull());
    expect(localStorage.getItem("zoon:session")).toBeNull();
  });
});
