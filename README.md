# Zooid Web Client

The **Zooid web client** is an open-source web [Matrix](https://matrix.org) client, built from scratch for collaborating with AI agents. It looks like a normal chat client — rooms, timelines, threads, federation — but it makes an agent's work *legible*: a live plan board, tool calls with inline diffs, a command palette that autocompletes the agent's own commands, and inline approval cards.

It's the human-facing half of the [Zooid](https://github.com/zooid-ai/zooid) ecosystem: the **Zooid daemon** runs the agents and bridges them onto Matrix as an Application Service; the web client is where you talk to them. Any standard Matrix client works with Zooid agents — the Zooid web client adds the agent-collaboration UX on top.

See the [web client docs](https://zooid.dev/docs/concepts/client/) for the user-facing overview.

## Quickstart

The fastest way to see the web client running is through the `zooid` CLI — `zooid dev` boots the whole local stack and serves this client for you, so you don't build or host it yourself.

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) (or Podman), [Node.js](https://nodejs.org) ≥ 22, and an ACP-compatible agent on your PATH — e.g. [Claude Code](https://www.claude.com/product/claude-code), Codex, GitHub Copilot CLI, Cursor CLI, Gemini CLI, [pi](https://agentclientprotocol.com), or [opencode](https://opencode.ai).

Install the CLI:

```bash
npm install -g zooid
```

Scaffold a workforce:

```bash
mkdir my-workforce && cd my-workforce
zooid init
```

`zooid init` asks which ACP harness (Claude Code, Codex, opencode, …), which model provider, and how to authenticate, then writes a clean `zooid.yaml` and any `.env` it needs.

Boot the local stack:

```bash
zooid dev
```

`zooid dev` starts a Tuwunel Matrix homeserver in a container, generates the Application Service registration, registers an `admin:admin` user, runs the daemon, and serves this web client's Vite build. Open `http://localhost:5173`, log in as `admin` / `admin`, join `#welcome`, and `@`-mention your agent.

To iterate on the client itself (HMR against an existing homeserver) instead of running the bundled build, see [Getting started](#getting-started) below.

## Repository layout

This is a pnpm monorepo (`zooid-clients`). Today it holds a single package:

```
packages/
  web/        @zooid/web — the React/Vite Matrix client
```

The client is built on `matrix-js-sdk` (Apache-2.0) with React 18, Vite, Tailwind v4, and a shadcn/Radix design system. It is **not** a fork of Element.

## Getting started

Requires Node ≥ 22 and pnpm 10.

```bash
pnpm install

# Vite dev server (http://localhost:5173)
pnpm -C packages/web dev
```

In normal use you don't run the web client standalone — `zooid dev` (from the Zooid repo) brings up Tuwunel + the daemon + this web client together as a full local stack. Run it standalone when iterating on the client against an existing homeserver.

You must point the client at a homeserver. Set `VITE_MATRIX_HOMESERVER_URL` before starting Vite, or use the `dev:matrix.org` shortcut to run against the public matrix.org homeserver with no config:

```bash
# Against a local or custom homeserver
VITE_MATRIX_HOMESERVER_URL=https://matrix.example.com pnpm -C packages/web dev

# Against matrix.org (no config needed)
pnpm -C packages/web dev:matrix.org
```

## Commands

```bash
# Root (runs across all packages)
pnpm build          # Build all packages
pnpm test           # Test all packages
pnpm typecheck      # Type-check all packages

# Web client (from packages/web)
pnpm -C packages/web dev              # Vite dev server
pnpm -C packages/web test             # Vitest (unit/component)
pnpm -C packages/web test:e2e         # Playwright end-to-end
pnpm -C packages/web typecheck
pnpm -C packages/web lint
pnpm -C packages/web storybook        # Storybook component workshop (:6006)
pnpm -C packages/web build-storybook
```

## How it works

Zooid agents speak [ACP](https://agentclientprotocol.com) (Agent Client Protocol). The daemon mirrors ACP session updates onto Matrix as custom `dev.zooid.*` events (plans, tool calls, diffs, advertised commands, approval requests). The web client decodes those events and renders the agent-aware surfaces:

- **Live plan board** — `dev.zooid.plan` (or a recognized planning tool call) → one task panel that updates in place as steps complete, uniform across Claude Code, Codex, and opencode.
- **Inline diffs** — file edits in `dev.zooid.tool_call_update` content rendered as add/remove patches inside the tool-call card.
- **Command palette** — `dev.zooid.available_commands_update` → the composer's `/` menu autocompletes the agent's own commands alongside the client's built-ins (`/clear`, `/interrupt`), tagged by source.
- **Inline approval cards** — `dev.zooid.approval_request` → one-click Allow / Deny in the timeline.
- **Media** — image/file attachments that flow end to end to the agent.

User-facing terminology follows Matrix: **spaces** and **rooms**. Conversations with agents run in **threads**.

## Testing & component development

- **Vitest** for unit and component tests, colocated as `*.test.ts(x)`. Hooks/components are tested against a fake Matrix client via `packages/web/test/factories.ts`.
- **Playwright** for end-to-end flows (`pnpm -C packages/web test:e2e`).
- **Storybook** (`:6006`) is the component workshop. Stories come in two flavors: *leaf* stories (a component fed fixture props) and *scene* stories (the real timeline against a fixture-seeded fake client) — the latter reuse the same test factories, so you can see the plan board or a diff card in a realistic timeline without an agent or a server.

## License

MIT — see [LICENSE](./LICENSE).
