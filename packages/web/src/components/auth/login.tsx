import { useEffect, useState } from "react";
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
        </CardContent>
      </Card>
    </div>
  );
}
