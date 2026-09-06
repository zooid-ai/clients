---
"@zooid/web": minor
---

Web push notifications ([ZNC025]). A service worker renders pushes from the
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
