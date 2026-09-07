import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./app";
import { MatrixClientPeg } from "./client/peg";
import { setGlobalSearchEnabled } from "./client/feature-flags";
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
    setGlobalSearchEnabled(true);
  });

  it("renders <Login /> when no session is in storage", async () => {
    render(<App config={{ homeserverUrl: HS }} />);
    expect(await screen.findByLabelText(/username/i)).toBeInTheDocument();
  });

  it("keeps a logged-out user on /signup instead of bouncing to /login", async () => {
    mswServer.use(
      http.post(`${HS}/_matrix/client/v3/register`, () =>
        HttpResponse.json(
          { session: "s1", flows: [{ stages: ["m.login.dummy"] }], params: {} },
          { status: 401 },
        ),
      ),
    );
    render(<App config={{ homeserverUrl: HS }} initialRoute="/signup" />);
    // The <Register> screen's submit button — proves we landed on /signup …
    expect(
      await screen.findByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
    // … and the redirect effect did NOT bounce us to <Login> (its "Sign in" button).
    expect(screen.queryByRole("button", { name: /^sign in$/i })).toBeNull();
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
    expect(screen.getByRole("button", { name: /user menu/i })).toBeInTheDocument();
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

  it("does not route /search when global search is off", async () => {
    setGlobalSearchEnabled(false);
    localStorage.setItem(
      "zoon:session",
      JSON.stringify({
        homeserverUrl: HS,
        accessToken: "tok",
        userId: "@alice:h.example",
        deviceId: "DEV1",
      }),
    );
    render(<App config={{ homeserverUrl: HS }} initialRoute="/search" />);
    await waitFor(() => expect(screen.getByTestId("logged-in-view")).toBeInTheDocument());
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
