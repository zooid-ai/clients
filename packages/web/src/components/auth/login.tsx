import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  fetchLoginFlows,
  type LoginFlow,
  loginWithPassword,
  ssoRedirectUrl,
} from "../../client/login";
import { MatrixClientPeg } from "../../client/peg";
import { registrationSupported } from "../../client/register";

interface LoginProps {
  homeserverUrl: string;
  defaultIdpLabel: string | null;
}

export function Login({ homeserverUrl, defaultIdpLabel }: LoginProps) {
  const [flows, setFlows] = useState<LoginFlow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [canRegister, setCanRegister] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    fetchLoginFlows(homeserverUrl)
      .then(setFlows)
      .catch((e) => setError(String(e.message ?? e)));
  }, [homeserverUrl]);

  useEffect(() => {
    registrationSupported(homeserverUrl)
      .then((s) => setCanRegister(s.supported))
      .catch(() => setCanRegister(false));
  }, [homeserverUrl]);

  // Opt-in (VITE_AUTO_REDIRECT_SINGLE_SSO): on an SSO-only homeserver with a
  // single IdP (e.g. the Zoon community space behind accounts.zooid.dev), skip
  // the login screen and redirect straight to the provider. Off by default, so
  // normal multi-option servers always render the chooser.
  const autoRedirectSingleSso =
    (import.meta.env.VITE_AUTO_REDIRECT_SINGLE_SSO as string | undefined) === "true";
  const singleSsoOnly =
    !!flows &&
    !flows.some((f) => f.type === "m.login.password") &&
    (() => {
      const sso = flows.find((f) => f.type === "m.login.sso");
      const idps = sso?.identity_providers ?? (sso ? [{ id: "" }] : []);
      return idps.length === 1;
    })();

  useEffect(() => {
    if (!flows || redirectedRef.current || !autoRedirectSingleSso || !singleSsoOnly) return;
    const sso = flows.find((f) => f.type === "m.login.sso");
    const idps = sso?.identity_providers ?? (sso ? [{ id: "" }] : []);
    redirectedRef.current = true;
    const callback = `${window.location.origin}/auth/callback`;
    window.location.assign(ssoRedirectUrl(homeserverUrl, callback, idps[0]?.id || undefined));
  }, [flows, homeserverUrl, autoRedirectSingleSso, singleSsoOnly]);

  if (!flows) {
    return <div role="status">Loading login options…</div>;
  }

  // Auto-redirect in flight — avoid flashing the chooser.
  if (autoRedirectSingleSso && singleSsoOnly) {
    return <div role="status">Redirecting to sign in…</div>;
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

  const ssoIdps = ssoFlow?.identity_providers ?? (ssoFlow ? [{ id: "", name: defaultIdpLabel ?? "SSO" }] : []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <div role="alert" className="text-destructive text-sm">
              {error}
            </div>
          )}
          {passwordFlow && (
            <form onSubmit={onPasswordSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" disabled={submitting}>
                Sign in
              </Button>
            </form>
          )}
          {passwordFlow && ssoFlow && <Separator />}
          {ssoIdps.map((idp) => (
            <Button
              key={idp.id || "default-sso"}
              type="button"
              variant="outline"
              onClick={() => onSso(idp.id || undefined)}
            >
              Sign in with {idp.name}
            </Button>
          ))}
          {canRegister && (
            <p className="text-muted-foreground text-sm">
              No account?{" "}
              <Link to="/signup" className="underline">
                Create account
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
