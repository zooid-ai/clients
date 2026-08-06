# @zooid/zoon-web

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
