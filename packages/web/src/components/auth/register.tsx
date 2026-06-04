import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MatrixClientPeg } from "../../client/peg";
import { registerWithPassword, registrationSupported } from "../../client/register";

export function Register({ homeserverUrl }: { homeserverUrl: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [requiresToken, setRequiresToken] = useState(false);
  const [token, setToken] = useState(params.get("token") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    registrationSupported(homeserverUrl)
      .then((s) => setRequiresToken(s.requiresToken))
      .catch(() => {});
  }, [homeserverUrl]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      const creds = await registerWithPassword(
        homeserverUrl,
        String(fd.get("username") ?? ""),
        String(fd.get("password") ?? ""),
        { token: token || undefined },
      );
      MatrixClientPeg.set(creds);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <div role="alert" className="text-destructive text-sm">
              {error}
            </div>
          )}
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-username">Username</Label>
              <Input id="reg-username" name="username" autoComplete="username" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-password">Password</Label>
              <Input
                id="reg-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            {requiresToken && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-token">Registration token</Label>
                <Input
                  id="reg-token"
                  name="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </div>
            )}
            <Button type="submit" disabled={submitting}>
              Create account
            </Button>
          </form>
          <p className="text-muted-foreground text-sm">
            Already have an account?{" "}
            <Link to="/login" className="underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
