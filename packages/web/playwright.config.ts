import { defineConfig } from "@playwright/test";

const HS_PORT = process.env.MATRIX_HS_PORT ?? "8448";
const HS_URL = process.env.MATRIX_HOMESERVER_URL ?? `http://localhost:${HS_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  webServer: {
    command: `VITE_MATRIX_HOMESERVER_URL=${HS_URL} pnpm dev --host 127.0.0.1 --port 5173 --strictPort`,
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
