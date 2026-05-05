import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(here, "fixtures");

const SKIP = process.env.E2E_SKIP_DOCKER === "1";
const KEEP = process.env.E2E_KEEP_TUWUNEL === "1";

export default async function globalTeardown() {
  if (SKIP || KEEP) return;
  try {
    execSync(`docker compose -f ${fixtureDir}/docker-compose.yml down -v`, {
      stdio: "inherit",
    });
  } catch {
    // best-effort
  }
}
