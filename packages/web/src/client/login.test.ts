import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { mswServer } from "../../test/setup";
import { exchangeLoginToken, fetchLoginFlows, loginWithPassword, ssoRedirectUrl } from "./login";

const HS = "https://h.example";

describe("fetchLoginFlows", () => {
  it("returns the flows array verbatim", async () => {
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
    const flows = await fetchLoginFlows(HS);
    expect(flows).toHaveLength(2);
    expect(flows[0].type).toBe("m.login.password");
    expect(flows[1].type).toBe("m.login.sso");
  });
});

describe("loginWithPassword", () => {
  it("POSTs to /login and returns credentials", async () => {
    mswServer.use(
      http.post(`${HS}/_matrix/client/v3/login`, async ({ request }) => {
        const body = (await request.json()) as { type: string; password: string };
        expect(body.type).toBe("m.login.password");
        expect(body.password).toBe("hunter2");
        return HttpResponse.json({
          access_token: "tok",
          user_id: "@alice:h.example",
          device_id: "DEV1",
        });
      }),
    );
    const creds = await loginWithPassword(HS, "alice", "hunter2");
    expect(creds).toEqual({
      accessToken: "tok",
      userId: "@alice:h.example",
      deviceId: "DEV1",
      homeserverUrl: HS,
    });
  });

  it("throws on 403", async () => {
    mswServer.use(
      http.post(`${HS}/_matrix/client/v3/login`, () =>
        HttpResponse.json({ errcode: "M_FORBIDDEN", error: "wrong" }, { status: 403 }),
      ),
    );
    await expect(loginWithPassword(HS, "alice", "wrong")).rejects.toThrow(/wrong/);
  });
});

describe("ssoRedirectUrl", () => {
  it("builds the redirect URL with idpId when supplied", () => {
    const url = ssoRedirectUrl(HS, "https://app.example/auth/callback", "zoon");
    expect(url).toBe(
      `${HS}/_matrix/client/v3/login/sso/redirect/zoon?redirectUrl=${encodeURIComponent("https://app.example/auth/callback")}`,
    );
  });

  it("omits idpId for default SSO", () => {
    const url = ssoRedirectUrl(HS, "https://app.example/auth/callback");
    expect(url).toBe(
      `${HS}/_matrix/client/v3/login/sso/redirect?redirectUrl=${encodeURIComponent("https://app.example/auth/callback")}`,
    );
  });
});

describe("exchangeLoginToken", () => {
  it("POSTs m.login.token and returns credentials", async () => {
    mswServer.use(
      http.post(`${HS}/_matrix/client/v3/login`, async ({ request }) => {
        const body = (await request.json()) as { type: string; token: string };
        expect(body.type).toBe("m.login.token");
        expect(body.token).toBe("LT");
        return HttpResponse.json({
          access_token: "tok",
          user_id: "@alice:h.example",
          device_id: "DEV2",
        });
      }),
    );
    const creds = await exchangeLoginToken(HS, "LT");
    expect(creds.accessToken).toBe("tok");
    expect(creds.deviceId).toBe("DEV2");
  });
});
