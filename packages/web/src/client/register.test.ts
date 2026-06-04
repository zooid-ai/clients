import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { mswServer } from "../../test/setup";
import { registerWithPassword, registrationSupported } from "./register";

const HS = "https://h.example";
const REG = `${HS}/_matrix/client/v3/register`;

describe("registrationSupported", () => {
  it("reports supported + no token for an open (dummy) server", async () => {
    mswServer.use(
      http.post(REG, () =>
        HttpResponse.json(
          { session: "s1", flows: [{ stages: ["m.login.dummy"] }], params: {} },
          { status: 401 },
        ),
      ),
    );
    expect(await registrationSupported(HS)).toEqual({ supported: true, requiresToken: false });
  });

  it("reports requiresToken when the flow needs a registration token", async () => {
    mswServer.use(
      http.post(REG, () =>
        HttpResponse.json(
          { session: "s1", flows: [{ stages: ["m.login.registration_token"] }], params: {} },
          { status: 401 },
        ),
      ),
    );
    expect(await registrationSupported(HS)).toEqual({ supported: true, requiresToken: true });
  });

  it("reports unsupported on 403 M_FORBIDDEN", async () => {
    mswServer.use(
      http.post(REG, () =>
        HttpResponse.json({ errcode: "M_FORBIDDEN", error: "off" }, { status: 403 }),
      ),
    );
    expect(await registrationSupported(HS)).toEqual({ supported: false, requiresToken: false });
  });
});

describe("registerWithPassword", () => {
  it("completes a dummy-stage flow and returns credentials", async () => {
    mswServer.use(
      http.post(REG, async ({ request }) => {
        const body = (await request.json()) as { auth?: { type: string }; username?: string };
        if (!body.auth) {
          return HttpResponse.json(
            { session: "s1", flows: [{ stages: ["m.login.dummy"] }], params: {} },
            { status: 401 },
          );
        }
        expect(body.auth.type).toBe("m.login.dummy");
        expect(body.username).toBe("alice");
        return HttpResponse.json({
          access_token: "tok",
          user_id: "@alice:h.example",
          device_id: "DEV1",
        });
      }),
    );
    const creds = await registerWithPassword(HS, "alice", "hunter2");
    expect(creds).toEqual({
      accessToken: "tok",
      userId: "@alice:h.example",
      deviceId: "DEV1",
      homeserverUrl: HS,
    });
  });

  it("completes a registration-token flow when a token is supplied", async () => {
    mswServer.use(
      http.post(REG, async ({ request }) => {
        const body = (await request.json()) as { auth?: { type: string; token?: string; session?: string } };
        if (!body.auth) {
          return HttpResponse.json(
            { session: "s2", flows: [{ stages: ["m.login.registration_token"] }], params: {} },
            { status: 401 },
          );
        }
        expect(body.auth.type).toBe("m.login.registration_token");
        expect(body.auth.token).toBe("INVITE-123");
        expect(body.auth.session).toBe("s2");
        return HttpResponse.json({
          access_token: "tok2",
          user_id: "@bob:h.example",
          device_id: "DEV2",
        });
      }),
    );
    const creds = await registerWithPassword(HS, "bob", "hunter2", { token: "INVITE-123" });
    expect(creds.userId).toBe("@bob:h.example");
  });

  it("throws a token-required error when the server needs a token and none is given", async () => {
    mswServer.use(
      http.post(REG, () =>
        HttpResponse.json(
          { session: "s3", flows: [{ stages: ["m.login.registration_token"] }], params: {} },
          { status: 401 },
        ),
      ),
    );
    await expect(registerWithPassword(HS, "carol", "hunter2")).rejects.toThrow(/token/i);
  });

  it("surfaces M_USER_IN_USE", async () => {
    mswServer.use(
      http.post(REG, () =>
        HttpResponse.json(
          { errcode: "M_USER_IN_USE", error: "User ID already taken." },
          { status: 400 },
        ),
      ),
    );
    await expect(registerWithPassword(HS, "alice", "hunter2")).rejects.toThrow(/already taken/i);
  });

  it("rejects an unsupported (email/captcha-only) flow", async () => {
    mswServer.use(
      http.post(REG, () =>
        HttpResponse.json(
          { session: "s4", flows: [{ stages: ["m.login.email.identity"] }], params: {} },
          { status: 401 },
        ),
      ),
    );
    await expect(registerWithPassword(HS, "dave", "hunter2")).rejects.toThrow(/not supported/i);
  });
});
