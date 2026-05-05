import { HS_URL, expect, test } from "./fixtures/daemon-impersonator";

test("approval Allow click round-trips to a Matrix response event", async ({
  page,
  human,
  daemon,
}) => {
  // 1. Daemon-impersonator creates a room with the human invited.
  const roomId = await daemon.createRoomWithHuman(human.userId);

  // 2. Auto-accept the invite as the human (REST — invite UI is not in MVP).
  const acceptRes = await fetch(
    `${HS_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${human.accessToken}` },
    },
  );
  expect(acceptRes.ok).toBeTruthy();

  // 3. Daemon posts the approval request.
  const { approvalId } = await daemon.sendApprovalRequest(roomId, {
    sessionId: "s-e2e",
    toolCallId: "tc-e2e",
  });

  // 4. Browser: log in as the human via password flow.
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(human.username);
  await page.getByLabel(/password/i).fill(human.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  // 5. Wait for the post-login shell, then navigate directly to the room URL.
  //    matrix-js-sdk computes room.name from members for nameless rooms, so
  //    we can't reliably click "the link with the roomId text" — go by URL.
  await page.getByRole("button", { name: /log out/i }).waitFor();
  await page.goto(`/room/${roomId}`);

  // 6. Approval card visible; click Allow.
  await expect(page.getByTestId("approval-card")).toBeVisible();
  await page.getByRole("button", { name: /allow/i }).click();

  // 7. Daemon-impersonator polls for the response event.
  const response = await daemon.waitForApprovalResponse(roomId, approvalId);
  expect(response.decision).toBe("allow");
  expect(response.sender).toBe(human.userId);

  // 8. Card flips to "Approved by …" without a page reload.
  await expect(page.getByTestId("approval-card")).toContainText(/approved by/i);
});
