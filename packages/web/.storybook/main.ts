import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import { createRequire } from "node:module";

// The trailing slash forces a node_modules lookup; bare "events" resolves to
// Node's builtin.
const EVENTS_POLYFILL = createRequire(import.meta.url).resolve("events/");

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp",
  ],
  framework: "@storybook/react-vite",
  core: { disableTelemetry: true },
  // Polyfill Node.js `events` so test/factories.ts (which uses EventEmitter)
  // can be imported in scene stories running in the browser environment.
  viteFinal: async (config) =>
    mergeConfig(config, {
      resolve: {
        alias: { events: EVENTS_POLYFILL },
      },
    }),
};
export default config;
