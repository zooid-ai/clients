import { expect } from "@playwright/test";
import { HS_URL, test } from "./fixtures/daemon-impersonator";

// createRoomWithHuman only *invites*; without joining, sends from the composer
// never land. Both other specs do this too.
async function joinAsHuman(roomId: string, accessToken: string) {
  const res = await fetch(
    `${HS_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`,
    { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  expect(res.ok).toBeTruthy();
}

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test(
  "human attaches an image; the daemon-side downloads it via authenticated media",
  async ({ page, human, daemon }) => {
    const roomId = await daemon.createRoomWithHuman(human.userId);
    await joinAsHuman(roomId, human.accessToken);

    await page.goto("/login");
    await page.getByLabel(/username/i).fill(human.username);
    await page.getByLabel(/password/i).fill(human.password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    // Wait for the post-login shell before navigating: going straight to the
    // room aborts the in-flight login and lands back on /login.
    await page.getByRole("button", { name: /user menu/i }).waitFor();
    await page.goto(`/room/${roomId}`);

    await page.locator('input[type="file"]').setInputFiles({
      name: "tiny.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await page.getByRole("textbox", { name: /message/i }).fill("what is this?");
    await page.keyboard.press("Enter");

    // daemon end: m.image lands, bytes retrievable via authenticated media + AS token
    const imageEvent = await daemon.waitForMessage(
      roomId,
      (e) => (e.content as { msgtype?: string })?.msgtype === "m.image",
    );
    const bytes = await daemon.downloadMedia(
      (imageEvent.content as { url: string }).url,
    );
    expect(bytes.equals(TINY_PNG)).toBe(true);

    // daemon replies; the image tile renders in the timeline
    await daemon.sendText(roomId, `saw your image (${bytes.length} bytes)`);
    await expect(page.getByRole("img", { name: "tiny.png" })).toBeVisible({ timeout: 10_000 });
    // Derived, not hardcoded: the daemon interpolates bytes.length, so a
    // literal here silently rots the moment the fixture image changes.
    await expect(
      page.getByText(`saw your image (${bytes.length} bytes)`, { exact: false }),
    ).toBeVisible({ timeout: 10_000 });
  },
);

test("composer blocks oversized attachments client-side", async ({
  page,
  human,
  daemon,
}) => {
  const roomId = await daemon.createRoomWithHuman(human.userId);
  await joinAsHuman(roomId, human.accessToken);
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(human.username);
  await page.getByLabel(/password/i).fill(human.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Wait for the post-login shell before navigating: going straight to the
  // room aborts the in-flight login and lands back on /login.
  await page.getByRole("button", { name: /user menu/i }).waitFor();
  await page.goto(`/room/${roomId}`);

  await page.locator('input[type="file"]').setInputFiles({
    name: "big.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(524_289),
  });
  await expect(page.getByRole("alert")).toContainText(/0\.5\s?MB/i);
});
