# @zooid/zoon-web

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
