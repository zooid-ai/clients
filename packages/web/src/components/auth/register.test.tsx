import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mswServer } from "../../../test/setup";
import { MatrixClientPeg } from "../../client/peg";
import { Register } from "./register";

const HS = "https://h.example";
const REG = `${HS}/_matrix/client/v3/register`;

afterEach(() => {
  MatrixClientPeg.reset();
  vi.restoreAllMocks();
});

function renderRegister(initialEntry = "/signup") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Register homeserverUrl={HS} />
    </MemoryRouter>,
  );
}

describe("<Register>", () => {
  it("registers on an open server and installs credentials", async () => {
    mswServer.use(
      http.post(REG, async ({ request }) => {
        const body = (await request.json()) as { auth?: unknown };
        if (!body.auth) {
          return HttpResponse.json(
            { session: "s1", flows: [{ stages: ["m.login.dummy"] }], params: {} },
            { status: 401 },
          );
        }
        return HttpResponse.json({
          access_token: "tok",
          user_id: "@alice:h.example",
          device_id: "DEV1",
        });
      }),
    );
    const setSpy = vi.spyOn(MatrixClientPeg, "set").mockImplementation(() => {
      return {} as never;
    });
    const user = userEvent.setup();
    renderRegister();

    // Open server → no registration-token field.
    await waitFor(() => expect(screen.queryByLabelText(/registration token/i)).toBeNull());
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/^password/i), "hunter2");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "@alice:h.example", accessToken: "tok" }),
      ),
    );
  });

  it("shows the token field on a gated server and pre-fills it from ?token=", async () => {
    mswServer.use(
      http.post(REG, () =>
        HttpResponse.json(
          { session: "s1", flows: [{ stages: ["m.login.registration_token"] }], params: {} },
          { status: 401 },
        ),
      ),
    );
    renderRegister("/signup?token=INVITE-123");
    const tokenField = await screen.findByLabelText(/registration token/i);
    expect(tokenField).toHaveValue("INVITE-123");
  });

  it("renders the server error when the username is taken", async () => {
    mswServer.use(
      http.post(REG, async ({ request }) => {
        const body = (await request.json()) as { auth?: unknown };
        if (!body.auth) {
          return HttpResponse.json(
            { session: "s1", flows: [{ stages: ["m.login.dummy"] }], params: {} },
            { status: 401 },
          );
        }
        return HttpResponse.json(
          { errcode: "M_USER_IN_USE", error: "User ID already taken." },
          { status: 400 },
        );
      }),
    );
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/^password/i), "hunter2");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already taken/i);
  });
});
