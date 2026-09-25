# @zooid/web

The Zooid web client — a Matrix-based chat interface for collaborating with AI agents.

Built on [`matrix-js-sdk`](https://github.com/matrix-org/matrix-js-sdk) with Vite + React. Provides a split-pane UI for rooms, agents, and shared workspaces.

## Usage

This package is consumed automatically by [`zooid`](https://www.npmjs.com/package/zooid). When you run `zooid dev`, the daemon fetches the pinned `@zooid/web` tarball from the registry, verifies its integrity, and serves it on the local UI port.

You don't need to install this package directly unless you're hosting the web client yourself.

## Development

Clone `zooid` and `zooid-clients` as siblings in the same parent directory:

```bash
git clone https://github.com/zooid-ai/zooid
git clone https://github.com/zooid-ai/clients.git zooid-clients
```

Then work from `zooid-clients/packages/web`:

```bash
# dev server (Vite HMR)
pnpm -C zooid-clients/packages/web dev

# build dist/
pnpm -C zooid-clients/packages/web build

# run alongside zooid (live rebuild + serve)
zooid dev --watch-web
```

`zooid dev --watch-web` auto-detects the sibling `zooid-clients/packages/web` directory and serves it directly — no registry fetch needed during development.

## Building and serving

`pnpm build` writes a static site to `dist/`. Serve it from any static host and put a `config.json` next to `index.html`.

### Runtime config vs build-time env vars

Some settings are read at runtime and some are baked into the bundle.

**Runtime**: `/config.json`, fetched on every page load. Change it and reload; no rebuild needed. Keys: `homeserver_url`, `default_idp_label`, `global_search`, `push_gateway_url`, `vapid_public_key`.

**Build-time**: Vite `VITE_*` variables. Vite inlines them into the compiled JS, so they **cannot be changed after the build**, and `config.json` does not override them (except where noted). To change one, rebuild.

| Variable | Default | Effect |
|---|---|---|
| `VITE_WORKFORCE_SPACE` | `dev` | Localpart of the space alias (`#<value>:<server>`) the client treats as the workforce space. It is the initial scope, and it drives the sidebar and the room directory. |
| `VITE_MATRIX_HOMESERVER_URL` | unset | Fallback homeserver URL, used only when `config.json` has no `homeserver_url`. |
| `VITE_GLOBAL_SEARCH` | unset | Fallback for global search, used only when `config.json` has no `global_search`. |
| `VITE_AUTO_REDIRECT_SINGLE_SSO` | unset | Set to `true` to skip the login chooser and redirect straight to the provider on an SSO-only homeserver with a single IdP. |

### When the published npm build is enough

The `@zooid/web` tarball on npm is built with the default `VITE_WORKFORCE_SPACE` (`dev`). Use it as-is when the deployment's workforce space is `#dev:<server>`, as on `community.zoon.eco`. This is also what `zooid dev` serves.

### When you need a custom build

A vhost pinned to a different workforce space needs its own build. For example, `zooid.zoon.eco` points at `#hq`. The published tarball can't be reused, because the space name is compiled in and can't be repointed with `config.json`.

```bash
VITE_WORKFORCE_SPACE=hq pnpm -C packages/web build
```

Serve the resulting `dist/` for that vhost. Keep a separate build per vhost if their spaces differ. For the operational steps of deploying the hq build by hand, see the `manage-community-ec2` skill's "Updating" section in the `z` monorepo. `pnpm deploy:zooid.zoon.eco` is the from-source deploy script for hq.

### Symptom of a wrong or missing `VITE_WORKFORCE_SPACE`

Nothing crashes, so it is easy to miss. If the `#<VITE_WORKFORCE_SPACE>:<server>` alias doesn't resolve, the client falls back to auto-scoping the lone joined space, and most of the UI looks normal. Where that fallback can't apply (for example, the user has joined several spaces), the client stays on the home scope. The Lobby route then shows "Pick a room to get started" instead of the room directory.

If you see that on a deployment that should show the directory, check that the bundle was built with the right `VITE_WORKFORCE_SPACE`. Builds before `@zooid/web@0.12.0` show the same symptom even with a single joined space.

## License

MIT
