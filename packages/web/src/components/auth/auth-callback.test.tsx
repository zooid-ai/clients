import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { MatrixClientPeg } from "../../client/peg";
import { mswServer } from "../../../test/setup";
import { AuthCallback } from "./auth-callback";

const HS = "https://h.example";

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <Routes>
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route path="/auth/callback" element={<AuthCallback homeserverUrl={HS} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("<AuthCallback />", () => {
  afterEach(() => MatrixClientPeg.reset());

  it("exchanges loginToken and routes to /", async () => {
    mswServer.use(
      http.post(`${HS}/_matrix/client/v3/login`, async ({ request }) => {
        const body = (await request.json()) as { type: string; token: string };
        expect(body.type).toBe("m.login.token");
        expect(body.token).toBe("LT");
        return HttpResponse.json({
          access_token: "tok",
          user_id: "@alice:h.example",
          device_id: "DEV1",
        });
      }),
    );
    renderAt("?loginToken=LT");
    await waitFor(() => expect(screen.getByText("HOME")).toBeInTheDocument());
    expect(MatrixClientPeg.safeGet()!.getUserId()).toBe("@alice:h.example");
  });

  it("renders an error and does not populate the peg on exchange failure", async () => {
    mswServer.use(
      http.post(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({ errcode: "M_UNKNOWN_TOKEN", error: "expired" }, { status: 403 }),
      ),
    );
    renderAt("?loginToken=LT");
    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/i);
    expect(MatrixClientPeg.safeGet()).toBeNull();
  });

  it("redirects to /login when loginToken is missing", async () => {
    renderAt("");
    await waitFor(() => expect(screen.getByText("LOGIN")).toBeInTheDocument());
  });
});
