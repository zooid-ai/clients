import { expect } from "@playwright/test";
import { test } from "./fixtures/daemon-impersonator";

// 1x1 red PNG.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function signIn(
  page: import("@playwright/test").Page,
  human: { username: string; password: string },
) {
  await page.goto("/");
  await page.getByLabel(/username/i).fill(human.username);
  await page.getByLabel(/password/i).fill(human.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Navigating before the session is stored drops us back on the login form.
  await expect(page.getByTestId("logged-in-view")).toBeVisible({ timeout: 20_000 });
}

// Regression: avatars used to be rendered as <img src> against the legacy
// unauthenticated /_matrix/media/v3 thumbnail endpoint. Matrix 1.11 servers
// (Tuwunel included) refuse that — "Unauthenticated media is disabled" — so
// every avatar silently degraded to the generated placeholder. A rendered
// blob: URL is the proof the bytes came back over the authenticated endpoint.
test("another member's avatar renders in the timeline", async ({ page, human, daemon }) => {
  // Set the avatar before the room exists so the sender's m.room.member event
  // carries avatar_url from the start.
  const { userId: senderId } = await daemon.setAvatar(TINY_PNG);
  const roomId = await daemon.createRoomWithHuman(human.userId);
  await daemon.sendText(roomId, "hello from the architect");

  await signIn(page, human);
  await page.getByRole("button", { name: /^accept$/i }).first().click();
  await page.goto(`/room/${encodeURIComponent(roomId)}`);

  await expect(page.getByText("hello from the architect")).toBeVisible({ timeout: 10_000 });
  const avatar = page.getByRole("img", { name: senderId }).first();
  await expect(avatar).toHaveAttribute("src", /^blob:/, { timeout: 10_000 });
});

test("an avatar uploaded from settings renders for the uploader", async ({
  page,
  human,
  daemon,
}) => {
  const roomId = await daemon.createRoomWithHuman(human.userId);
  await signIn(page, human);
  await page.goto(`/room/${encodeURIComponent(roomId)}`);

  const selfAvatar = page.getByRole("img", { name: human.userId }).first();
  await expect(selfAvatar).toHaveAttribute("src", /^data:/, { timeout: 10_000 });

  await page.getByRole("button", { name: /user menu/i }).click();
  await page.getByRole("menuitem", { name: /settings/i }).click();
  await page.getByLabel(/avatar/i).setInputFiles({
    name: "me.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  await page.getByRole("button", { name: /^save$/i }).click();

  await expect(selfAvatar).toHaveAttribute("src", /^blob:/, { timeout: 10_000 });
});
