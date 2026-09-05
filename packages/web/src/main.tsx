import "@/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, type AppConfig } from "./app";
import { BootstrapError } from "@/components/bootstrap-error";
import { ThemeProvider } from "@/components/theme-provider";
import { discoverHomeserver } from "./client/homeserver-discovery";
import { resolveGlobalSearch, setGlobalSearchEnabled } from "./client/feature-flags";
import { loadRuntimeConfig } from "./client/runtime-config";

const buildtimeUrl = (import.meta.env.VITE_MATRIX_HOMESERVER_URL as string | undefined) ?? null;

async function bootstrap() {
  const runtime = await loadRuntimeConfig();
  setGlobalSearchEnabled(
    resolveGlobalSearch({
      runtime: runtime?.global_search,
      buildtime: import.meta.env.VITE_GLOBAL_SEARCH as string | undefined,
    }),
  );
  const homeserverUrl = await discoverHomeserver({
    mxid: null,
    runtimeConfig: runtime,
    buildtimeUrl,
  });
  const config: AppConfig = {
    homeserverUrl,
    defaultIdpLabel: runtime?.default_idp_label ?? null,
    pushGatewayUrl: runtime?.push_gateway_url,
    vapidPublicKey: runtime?.vapid_public_key,
  };
  if (import.meta.env.DEV) {
    // Affordance for Playwright e2e (and ZNC002 features) to call SDK methods
    // directly inside the browser context. Dev-only — production builds drop this.
    (globalThis as unknown as { matrixcs: unknown }).matrixcs = await import("matrix-js-sdk");
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider defaultTheme="system">
        <App config={config} />
      </ThemeProvider>
    </StrictMode>,
  );
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("Bootstrap failed:", e);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider defaultTheme="system">
        <BootstrapError error={e} />
      </ThemeProvider>
    </StrictMode>,
  );
});
