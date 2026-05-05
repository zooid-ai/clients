import { useEffect, useState } from "react";
import {
  fetchLoginFlows,
  type LoginFlow,
  loginWithPassword,
  ssoRedirectUrl,
} from "../../client/login";
import { MatrixClientPeg } from "../../client/peg";

interface LoginProps {
  homeserverUrl: string;
  defaultIdpLabel: string | null;
}

export function Login({ homeserverUrl, defaultIdpLabel }: LoginProps) {
  const [flows, setFlows] = useState<LoginFlow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLoginFlows(homeserverUrl)
      .then(setFlows)
      .catch((e) => setError(String(e.message ?? e)));
  }, [homeserverUrl]);

  if (!flows) {
    return <div role="status">Loading login options…</div>;
  }

  const passwordFlow = flows.find((f) => f.type === "m.login.password");
  const ssoFlow = flows.find((f) => f.type === "m.login.sso");

  const onPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      const creds = await loginWithPassword(
        homeserverUrl,
        String(fd.get("username") ?? ""),
        String(fd.get("password") ?? ""),
      );
      MatrixClientPeg.set(creds);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onSso = (idpId?: string) => {
    const callback = `${window.location.origin}/auth/callback`;
    window.location.assign(ssoRedirectUrl(homeserverUrl, callback, idpId));
  };

  return (
    <div className="login">
      {error && <div role="alert">{error}</div>}

      {passwordFlow && (
        <form onSubmit={onPasswordSubmit}>
          <label>
            Username
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit" disabled={submitting}>
            Sign in
          </button>
        </form>
      )}

      {ssoFlow && (
        <div className="sso">
          {(ssoFlow.identity_providers ?? [{ id: "", name: defaultIdpLabel ?? "SSO" }]).map((idp) => (
            <button key={idp.id} type="button" onClick={() => onSso(idp.id || undefined)}>
              Sign in with {idp.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
