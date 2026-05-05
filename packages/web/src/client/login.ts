export interface LoginFlow {
  type: string;
  identity_providers?: { id: string; name: string }[];
  // Other flow-specific fields are forward-compatible — the client looks at
  // `type` and `identity_providers` only.
  [k: string]: unknown;
}

export interface Credentials {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
}

export async function fetchLoginFlows(homeserverUrl: string): Promise<LoginFlow[]> {
  const res = await fetch(`${homeserverUrl}/_matrix/client/v3/login`);
  if (!res.ok) throw await matrixError(res);
  const json = (await res.json()) as { flows: LoginFlow[] };
  return json.flows;
}

export async function loginWithPassword(
  homeserverUrl: string,
  username: string,
  password: string,
): Promise<Credentials> {
  const res = await fetch(`${homeserverUrl}/_matrix/client/v3/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "m.login.password",
      identifier: { type: "m.id.user", user: username },
      password,
      initial_device_display_name: "Zoon Web",
    }),
  });
  if (!res.ok) throw await matrixError(res);
  return parseCredentials(homeserverUrl, await res.json());
}

export async function exchangeLoginToken(
  homeserverUrl: string,
  loginToken: string,
): Promise<Credentials> {
  const res = await fetch(`${homeserverUrl}/_matrix/client/v3/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "m.login.token",
      token: loginToken,
      initial_device_display_name: "Zoon Web",
    }),
  });
  if (!res.ok) throw await matrixError(res);
  return parseCredentials(homeserverUrl, await res.json());
}

export function ssoRedirectUrl(
  homeserverUrl: string,
  redirectUrl: string,
  idpId?: string,
): string {
  const path = idpId
    ? `/_matrix/client/v3/login/sso/redirect/${encodeURIComponent(idpId)}`
    : `/_matrix/client/v3/login/sso/redirect`;
  return `${homeserverUrl}${path}?redirectUrl=${encodeURIComponent(redirectUrl)}`;
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

async function matrixError(res: Response): Promise<Error> {
  try {
    const j = (await res.json()) as { error?: string; errcode?: string };
    return new Error(j.error ?? j.errcode ?? `HTTP ${res.status}`);
  } catch {
    return new Error(`HTTP ${res.status}`);
  }
}
