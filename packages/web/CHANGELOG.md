# @zooid/zoon-web

## 0.14.0

### Minor Changes

- a252e7c: Display and answer agent elicitation forms, with confirmed resolution, field feedback, threaded questions, notifications, and awaiting-input status.

### Patch Changes

- bcfc7d1: A message the server rejects (for example sending from a room you've only been invited to) now shows as "Not sent" on its own tile with the reason, a Retry button that reuses the same transaction ID, and a Delete button, instead of looking delivered with a raw error under the composer.

## 0.13.0

### Minor Changes

- Share and quote threads: every thread has a link you can copy and open directly, you can quote a message into your reply, and a share dialog posts a thread into another room — with a room picker and @mentions in the note. The client also opens on the workforce space the daemon advertises in its runtime config, so a fresh `zooid dev` lands you in the right place, and the Storybook build no longer breaks on the events polyfill.
- 6a0fc2d: Read the initial workforce space from `workforce_space` in runtime `config.json` (default `dev`). The build-time `VITE_WORKFORCE_SPACE` setting is removed, so one bundle can serve several vhosts.
- 35dd51e: Share dialog: pick the room from a search field with autocomplete, and write the comment in the composer's input so `@mentions` of the target room's members work. The composer's input core is now a shared `MessageInput`.
- 263b49b: Copy link, quote and share messages and threads. Thread links open in the app and highlight the linked reply, a quoted message travels with a `dev.zooid.quote` reference and a readable body fallback, and Edit and Delete move into a new ⋯ menu on the message hover bar.

## 0.12.1

### Patch Changes

- ce32958: Read the workforce roster from every `dev.zooid.workforce` state key in the space, not only `""`. Daemons now publish one roster per workstation, so agents from every workstation are recognized as agents.

## 0.12.0

### Minor Changes

- Add service worker push notifications with pusher lifecycle, agent push rules, and a turn-end sound; a space lobby landing page acting as the space's directory; paste/drop attachments with a composer preview tray; clickable links and a See more toggle for long thread roots in plain-text messages; and persisted Matrix sync state in IndexedDB. Fix notification dismissal timing, push-rule self-healing and positioning, the Lobby's active-scope filtering, and the Lobby filter input layout.

## 0.11.0

### Minor Changes

- bf1de36: Web push notifications ([ZNC025]). A service worker renders pushes from the
  daemon's push gateway, so an agent can reach you with the tab closed — the
  in-page notifier only ran while a tab was open and focused.

  - Push subscription lifecycle: permission is requested on an explicit click,
    never on mount; the pusher is registered against the homeserver and
    reconciled on load, repairing a stale gateway URL or missing push rules
    rather than blindly re-registering.
  - Three agent push rules (`approval_request`, `turn.end`, `error`) installed as
    plain overrides, with per-rule toggles in notification settings.
  - Notifications for agent events persist until dismissed rather than expiring
    as a banner — they exist for when you are away from the screen — and a
    room's notifications are dismissed once you are actually looking at it.
  - `turn.end` notifications show the agent's closing message, not just that it
    finished.
  - The service worker takes over on install, so a change to push handling
    reaches tabs that stay open.
  - Turn-end sound cue, played by a live client so the notification stays silent.

## 0.10.0

### Minor Changes

- Room and thread reliability and navigation improvements:

  - Fix room history getting lost after idle gaps and inside threads.
  - Auto-select the sole joined space when the workforce space doesn't resolve.
  - Clarify the thread-exit button and add a typing-gated Stop button.
  - Pin Playwright to one version and repair the rotted e2e specs.

## 0.9.1

### Patch Changes

- Fetch avatars over authenticated media. User and room avatars were requested from the legacy unauthenticated `/_matrix/media/v3` thumbnail endpoint, which Matrix 1.11 homeservers refuse (Tuwunel: "Unauthenticated media is disabled"), so every avatar silently fell back to the generated placeholder. They are now fetched with the access token against `/_matrix/client/v1/media` and rendered from an object URL, with a legacy fallback for pre-1.11 homeservers. A member's avatar also no longer stays stale until remount when it arrives via `m.room.member`.

  The room-header avatar stack's overflow count now shows a bare `+` past 9 instead of `+1000` spilling out of its circle; the exact count remains in the tooltip.

## 0.9.0

### Minor Changes

- Contain wide, unbreakable content within the chat pane. `min-w-0` on
  `SidebarInset` lets the pane shrink below its content's intrinsic width, so a
  long command in a tool-call card no longer pushes the composer past the
  viewport; the resolved-approval subtitle now wraps long paths (`break-words`).
  Includes `InLayoutChain` and `ResolvedLongCommand` regression stories.

## 0.8.0

### Minor Changes

- Search & discovery and collaboration surfaces:

  - Search & discovery page — All rooms directory with `global_search` flag (ZNC023), plus post-ship polish (bootstrap error handling, scope switching, search UX).
  - Room banner and space-home empty-state topic surfaces, with eager one-shot prefetch on room open.
  - Shared Matrix subscriptions and a member panel; browse-rooms fixes.
  - Message timestamps and date separators in the timeline.
  - Room header member avatar stack (replaces the member count chip).

## 0.1.0

### Minor Changes

- First release
