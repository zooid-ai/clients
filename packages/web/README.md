# @zooid/web

The Zooid web client — a Matrix-based chat interface for collaborating with AI agents.

Built on [`matrix-js-sdk`](https://github.com/matrix-org/matrix-js-sdk) with Vite + React. Provides a split-pane UI for rooms, agents, and shared workspaces.

## Usage

This package is consumed automatically by [`zooid`](https://www.npmjs.com/package/zooid). When you run `zooid dev`, the daemon fetches the pinned `@zooid/web` tarball from the registry, verifies its integrity, and serves it on the local UI port.

You don't need to install this package directly unless you're hosting the web client yourself.

## Runtime configuration

One published bundle serves every deployment. Host-specific settings live in a same-origin `/config.json` next to `index.html`, so a vhost changes behaviour by changing that file, not by rebuilding.

```json
{
  "homeserver_url": "https://matrix.example.com",
  "workforce_space": "acme"
}
```

`workforce_space` is optional. It is the alias localpart of the workforce space, without a leading `#` or a server name. On login the client resolves `#<workforce_space>:<server_name>`, joins it, and opens it as the initial scope. When the key is omitted the default is `dev`.

If the value is malformed, or the alias can't be resolved or joined, login still succeeds: the client opens the only joined space if there is exactly one, and Home otherwise.

The build-time workforce-space environment variable is removed and is ignored. To migrate a vhost that was built with it:

1. Deploy a bundle that includes this change. Until `config.json` names a space the client uses `dev` (or the sole joined space, if `#dev` doesn't resolve).
2. Add `"workforce_space": "<the value you used to build with>"` to that vhost's `config.json`.
3. Reload and confirm the expected space is selected, then drop the per-vhost build.

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

## License

MIT
