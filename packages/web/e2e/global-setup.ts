import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(here, "fixtures");

const HS_PORT = process.env.MATRIX_HS_PORT ?? "8448";
const HS_URL = process.env.MATRIX_HOMESERVER_URL ?? `http://localhost:${HS_PORT}`;
const SKIP = process.env.E2E_SKIP_DOCKER === "1";

async function waitForHomeserver(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${url}/_matrix/client/versions`);
      if (r.ok) return;
    } catch {
      // homeserver not yet up
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Tuwunel did not become healthy at ${url} within ${timeoutMs}ms`);
}

export default async function globalSetup() {
  if (SKIP) {
    // The caller is managing Tuwunel themselves; just verify it's up.
    await waitForHomeserver(HS_URL, 30_000);
    return;
  }
  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    throw new Error(
      "Docker is required for e2e (Tuwunel runs in a container). Set E2E_SKIP_DOCKER=1 if you're managing the homeserver yourself.",
    );
  }
  // -d to detach; teardown brings it down. Reuse existing if already up.
  execSync(`docker compose -f ${fixtureDir}/docker-compose.yml up -d`, {
    stdio: "inherit",
  });
  await waitForHomeserver(HS_URL, 60_000);
}
