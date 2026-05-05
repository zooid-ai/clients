import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, type AppConfig } from "./app";
import { discoverHomeserver } from "./client/homeserver-discovery";
import { loadRuntimeConfig } from "./client/runtime-config";

const buildtimeUrl = (import.meta.env.VITE_MATRIX_HOMESERVER_URL as string | undefined) ?? null;

async function bootstrap() {
  const runtime = await loadRuntimeConfig();
  const homeserverUrl = await discoverHomeserver({
    mxid: null,
    runtimeConfig: runtime,
    buildtimeUrl,
  });
  const config: AppConfig = {
    homeserverUrl,
    defaultIdpLabel: runtime?.default_idp_label ?? null,
  };
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  );
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("Bootstrap failed:", e);
  document.body.innerHTML = `<pre>Bootstrap failed: ${String(e?.message ?? e)}</pre>`;
});
