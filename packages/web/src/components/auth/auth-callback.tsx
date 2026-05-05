import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { exchangeLoginToken } from "../../client/login";
import { MatrixClientPeg } from "../../client/peg";

interface AuthCallbackProps {
  homeserverUrl: string;
}

export function AuthCallback({ homeserverUrl }: AuthCallbackProps) {
  const [params] = useSearchParams();
  const loginToken = params.get("loginToken");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loginToken) return;
    exchangeLoginToken(homeserverUrl, loginToken)
      .then((creds) => {
        MatrixClientPeg.set(creds);
        setDone(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [homeserverUrl, loginToken]);

  if (!loginToken) return <Navigate to="/login" replace />;
  if (error) return <div role="alert">{error}</div>;
  if (done) return <Navigate to="/" replace />;
  return <div role="status">Completing sign-in…</div>;
}
