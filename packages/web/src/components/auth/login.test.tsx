import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatrixClientPeg } from "../../client/peg";
import { mswServer } from "../../../test/setup";
import { Login } from "./login";

const HS = "https://h.example";

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Login homeserverUrl={HS} defaultIdpLabel={null} />
    </MemoryRouter>,
  );

describe("<Login />", () => {
  afterEach(() => MatrixClientPeg.reset());

  it("renders a password form when only m.login.password is advertised", async () => {
    mswServer.use(
      http.get(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({ flows: [{ type: "m.login.password" }] }),
      ),
    );
    renderLogin();
    expect(await screen.findByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in with/i })).not.toBeInTheDocument();
  });

  it("renders SSO buttons when m.login.sso is advertised", async () => {
    mswServer.use(
      http.get(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({
          flows: [
            {
              type: "m.login.sso",
              identity_providers: [
                { id: "zoon", name: "Zoon" },
                { id: "github", name: "GitHub" },
              ],
            },
          ],
        }),
      ),
    );
    renderLogin();
    expect(await screen.findByRole("button", { name: /sign in with zoon/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in with github/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("renders both forms when both flows are advertised", async () => {
    mswServer.use(
      http.get(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({
          flows: [
            { type: "m.login.password" },
            { type: "m.login.sso", identity_providers: [{ id: "zoon", name: "Zoon" }] },
          ],
        }),
      ),
    );
    renderLogin();
    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in with zoon/i })).toBeInTheDocument();
  });

  it("submitting password populates the peg and emits 'logged-in'", async () => {
    mswServer.use(
      http.get(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({ flows: [{ type: "m.login.password" }] }),
      ),
      http.post(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({
          access_token: "tok",
          user_id: "@alice:h.example",
          device_id: "DEV1",
        }),
      ),
    );
    renderLogin();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "hunter2");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => expect(MatrixClientPeg.safeGet()).not.toBeNull());
    expect(MatrixClientPeg.safeGet()!.getUserId()).toBe("@alice:h.example");
  });

  it("password failure renders an error and leaves the peg empty", async () => {
    mswServer.use(
      http.get(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({ flows: [{ type: "m.login.password" }] }),
      ),
      http.post(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({ errcode: "M_FORBIDDEN", error: "Invalid password" }, { status: 403 }),
      ),
    );
    renderLogin();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid password/i);
    expect(MatrixClientPeg.safeGet()).toBeNull();
  });

  it("clicking an SSO button navigates the browser to the redirect URL", async () => {
    mswServer.use(
      http.get(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({
          flows: [
            {
              type: "m.login.sso",
              identity_providers: [{ id: "zoon", name: "Zoon" }],
            },
          ],
        }),
      ),
    );
    const originalLocation = window.location;
    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation, assign: assignSpy, origin: "https://app.example" },
    });
    try {
      renderLogin();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: /sign in with zoon/i }));
      expect(assignSpy).toHaveBeenCalledWith(
        expect.stringContaining("/_matrix/client/v3/login/sso/redirect/zoon"),
      );
      expect(assignSpy.mock.calls[0][0]).toContain(
        encodeURIComponent("https://app.example/auth/callback"),
      );
    } finally {
      // Restore so subsequent tests aren't poisoned by the spy'd location.
      Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    }
  });
});
