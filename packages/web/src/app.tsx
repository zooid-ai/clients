import { useEffect, useState } from "react";
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MatrixClientPeg } from "./client/peg";
import { AuthCallback } from "./components/auth/auth-callback";
import { Login } from "./components/auth/login";
import { Register } from "./components/auth/register";
import { BrowseRoomsRoute } from "./components/structures/browse-rooms";
import { EmptyRoom } from "./components/structures/empty-room";
import { InvitesPage } from "./components/structures/invites-page";
import { LoggedInView } from "./components/structures/logged-in-view";
import { RoomView } from "./components/structures/room-view";
import { useAuthState } from "./hooks/use-auth-state";

export interface AppConfig {
  homeserverUrl: string;
  defaultIdpLabel?: string | null;
}

export function App({
  config,
  initialRoute,
}: {
  config: AppConfig;
  initialRoute?: string;
}) {
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const creds = MatrixClientPeg.restoreFromStorage();
    if (!creds) {
      setRestored(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      // A session restored from storage may belong to a previous homeserver
      // or use an access token the server has since revoked. Without this
      // check we'd mount the logged-in routes and surface a confusing
      // "workforce unavailable" instead of routing to /login.
      try {
        const client = MatrixClientPeg.get() as unknown as { whoami: () => Promise<unknown> };
        await client.whoami();
      } catch (err) {
        const e = err as { errcode?: string; data?: { errcode?: string }; httpStatus?: number };
        const errcode = e.errcode ?? e.data?.errcode;
        if (
          errcode === "M_UNKNOWN_TOKEN" ||
          errcode === "M_MISSING_TOKEN" ||
          errcode === "M_FORBIDDEN" ||
          e.httpStatus === 401
        ) {
          MatrixClientPeg.reset();
        }
      }
      if (!cancelled) setRestored(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!restored) return <div role="status">Loading…</div>;

  if (initialRoute) {
    return (
      <TooltipProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <AppRoutes config={config} />
        </MemoryRouter>
        <Toaster />
      </TooltipProvider>
    );
  }
  return (
    <TooltipProvider>
      <BrowserRouter>
        <AppRoutes config={config} />
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  );
}

function AppRoutes({ config }: { config: AppConfig }) {
  const auth = useAuthState();
  const navigate = useNavigate();

  // Auth state changes outside the router (e.g. logout button) need to drive
  // routing back to /login. The router itself is stateless on this signal so
  // we synchronise here.
  useEffect(() => {
    if (auth === "logged-out" && window.location.pathname !== "/auth/callback") {
      navigate("/login", { replace: true });
    }
  }, [auth, navigate]);

  return (
    <Routes>
      <Route
        path="/"
        element={auth === "logged-in" ? <LoggedInView /> : <Navigate to="/login" replace />}
      >
        <Route index element={<EmptyRoom />} />
        <Route path="room/:roomId" element={<RoomView />} />
        <Route path="browse" element={<BrowseRoomsRoute />} />
        <Route path="invites" element={<InvitesPage />} />
      </Route>
      <Route
        path="/login"
        element={
          auth === "logged-in" ? (
            <Navigate to="/" replace />
          ) : (
            <Login
              homeserverUrl={config.homeserverUrl}
              defaultIdpLabel={config.defaultIdpLabel ?? null}
            />
          )
        }
      />
      <Route
        path="/signup"
        element={
          auth === "logged-in" ? (
            <Navigate to="/" replace />
          ) : (
            <Register homeserverUrl={config.homeserverUrl} />
          )
        }
      />
      <Route path="/auth/callback" element={<AuthCallback homeserverUrl={config.homeserverUrl} />} />
    </Routes>
  );
}
