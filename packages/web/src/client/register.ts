import { type Credentials, matrixError } from "./login";

export interface RegistrationSupport {
  supported: boolean;
  requiresToken: boolean;
}

interface UiaChallenge {
  session: string;
  flows: { stages: string[] }[];
}

const DUMMY = "m.login.dummy";
const TOKEN = "m.login.registration_token";

function registerUrl(homeserverUrl: string): string {
  return `${homeserverUrl}/_matrix/client/v3/register`;
}

async function postRegister(homeserverUrl: string, body: unknown): Promise<Response> {
  return fetch(registerUrl(homeserverUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Probe whether password registration is available, and whether a token is required. */
export async function registrationSupported(homeserverUrl: string): Promise<RegistrationSupport> {
  const res = await postRegister(homeserverUrl, {});
  if (res.status === 401) {
    const { flows } = (await res.json()) as UiaChallenge;
    const requiresToken =
      flows.length > 0 && flows.every((f) => f.stages.includes(TOKEN) && !f.stages.includes(DUMMY));
    return { supported: true, requiresToken };
  }
  // 403 (M_FORBIDDEN) — registration disabled — or anything else: treat as unsupported.
  return { supported: false, requiresToken: false };
}

function parseCredentials(homeserverUrl: string, json: unknown): Credentials {
  const j = json as { access_token: string; user_id: string; device_id: string };
  return {
    homeserverUrl,
    accessToken: j.access_token,
    userId: j.user_id,
    deviceId: j.device_id,
  };
}

/** Register a new account, driving the UIA loop. Logs the caller in (returns credentials). */
export async function registerWithPassword(
  homeserverUrl: string,
  username: string,
  password: string,
  opts: { token?: string } = {},
): Promise<Credentials> {
  const base = { username, password, initial_device_display_name: "Zoon Web" };

  // First call carries no auth — the server replies 401 with the required flows.
  let res = await postRegister(homeserverUrl, base);
  if (res.ok) return parseCredentials(homeserverUrl, await res.json());
  if (res.status !== 401) throw await matrixError(res);

  const { session, flows } = (await res.json()) as UiaChallenge;
  const canDummy = flows.some((f) => f.stages.includes(DUMMY));
  const canToken = flows.some((f) => f.stages.includes(TOKEN));

  let auth: Record<string, unknown>;
  if (canDummy) {
    auth = { type: DUMMY, session };
  } else if (canToken) {
    if (!opts.token) throw new Error("This server requires a registration token to sign up.");
    auth = { type: TOKEN, token: opts.token, session };
  } else {
    throw new Error("This server's registration is not supported by Zoon.");
  }

  res = await postRegister(homeserverUrl, { ...base, auth });
  if (!res.ok) throw await matrixError(res);
  return parseCredentials(homeserverUrl, await res.json());
}
