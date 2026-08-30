import { HS_URL, expect, test } from "./fixtures/daemon-impersonator";
import type { Page } from "@playwright/test";
import type { FreshHuman } from "./fixtures/daemon-impersonator";

/**
 * Regression coverage for zooid-ai/zooid#14 — "random parts of the room
 * conversation loaded".
 *
 * Two distinct ways history went missing, both exercised here against a real
 * homeserver because neither is visible to a unit test:
 *
 *  1. A gappy ("limited: true") sync made matrix-js-sdk reset the room's
 *     timeline set, and without `timelineSupport` that reset discarded every
 *     event already loaded — so a tab that had been idle came back to a
 *     conversation with a hole in the middle.
 *  2. Opening a thread whose replies sat behind the sync window rendered
 *     almost nothing, and the "Load more" button was a no-op because it
 *     paginated a Thread object that never exists with thread support off.
 */

async function joinAsHuman(roomId: string, human: FreshHuman) {
  const res = await fetch(
    `${HS_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`,
    { method: "POST", headers: { Authorization: `Bearer ${human.accessToken}` } },
  );
  expect(res.ok).toBeTruthy();
}

async function loginAndOpenRoom(page: Page, human: FreshHuman, roomId: string) {
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(human.username);
  await page.getByLabel(/password/i).fill(human.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.getByRole("button", { name: /user menu/i }).waitFor();
  await page.goto(`/room/${roomId}`);
}

test("history loaded before an idle gap survives the reconnect sync", async ({
  page,
  human,
  daemon,
}) => {
  const roomId = await daemon.createRoomWithHuman(human.userId);
  await joinAsHuman(roomId, human);

  // Enough to sit outside the 10-event initial sync window, so the client has
  // to have back-paginated to be showing it at all.
  for (let i = 1; i <= 20; i++) {
    await daemon.sendText(roomId, `before-gap-${i}`);
  }

  await loginAndOpenRoom(page, human, roomId);
  await expect(page.getByText("before-gap-1", { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  // Go offline and let more than the server's /sync timeline limit accumulate.
  // That is what makes the next sync come back `limited: true`.
  await page.context().setOffline(true);
  for (let i = 1; i <= 40; i++) {
    await daemon.sendText(roomId, `after-gap-${i}`);
  }
  await page.context().setOffline(false);

  // The new messages arriving proves the client resynced and processed the
  // gappy response — the interesting assertion is the one after it.
  await expect(page.getByText("after-gap-40", { exact: true })).toBeVisible({
    timeout: 60_000,
  });

  // The regression: the reset used to wipe everything loaded before the gap.
  await expect(page.getByText("before-gap-1", { exact: true })).toBeVisible();
  await expect(page.getByText("before-gap-20", { exact: true })).toBeVisible();
});

test("thread replies behind the sync window are loaded when the thread opens", async ({
  page,
  human,
  daemon,
}) => {
  const roomId = await daemon.createRoomWithHuman(human.userId);
  await joinAsHuman(roomId, human);

  const rootId = await daemon.sendText(roomId, "thread-root question");
  for (let i = 1; i <= 8; i++) {
    await daemon.sendThreadReply(roomId, rootId, `old-reply-${i}`);
  }

  // Bury the root and the early replies well behind the sync window, so the
  // thread cannot be rendered from what sync alone delivers.
  for (let i = 1; i <= 60; i++) {
    await daemon.sendText(roomId, `filler-${i}`);
  }

  // One recent reply lands inside the window. Its root is fetched on demand,
  // which is why the thread is reachable from the timeline at all — and why
  // the reported symptom was "first question and last statement, nothing in
  // between".
  await daemon.sendThreadReply(roomId, rootId, "newest-reply");

  await loginAndOpenRoom(page, human, roomId);

  await page.getByRole("button", { name: /view thread \(\d+ events\)/i }).click();

  // Every reply the server knows about, not just the one that happened to be
  // inside the sync window.
  await expect(page.getByText("old-reply-1", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("old-reply-8", { exact: true })).toBeVisible();
  await expect(page.getByText("newest-reply", { exact: true })).toBeVisible();
});
