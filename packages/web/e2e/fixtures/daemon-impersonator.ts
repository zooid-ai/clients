import { test as base } from "@playwright/test";
import { type MatrixClient, createClient } from "matrix-js-sdk";
import { randomUUID } from "node:crypto";

const HS_PORT = process.env.MATRIX_HS_PORT ?? "8448";
export const HS_URL = process.env.MATRIX_HOMESERVER_URL ?? `http://localhost:${HS_PORT}`;
const AS_TOKEN =
  process.env.MATRIX_AS_TOKEN ?? "as-zoon-test-fixed-token-do-not-use-in-prod";
const AS_NAMESPACE_PREFIX = process.env.MATRIX_AS_NAMESPACE_PREFIX ?? "_zoon_test_";

export interface DaemonImpersonator {
  agentClient: MatrixClient;
  agentUserId: string;
  createRoomWithHuman(humanUserId: string): Promise<string>;
  sendApprovalRequest(
    roomId: string,
    opts: { sessionId: string; toolCallId: string },
  ): Promise<{ approvalId: string; eventId: string }>;
  waitForApprovalResponse(
    roomId: string,
    approvalId: string,
    timeoutMs?: number,
  ): Promise<{ decision: string; sender: string }>;
}

export interface FreshHuman {
  userId: string;
  accessToken: string;
  password: string;
  username: string;
}

export const test = base.extend<{ daemon: DaemonImpersonator; human: FreshHuman }>({
  human: async ({}, use) => {
    const username = `human_${randomUUID().slice(0, 8)}`;
    const password = randomUUID();
    // Open registration is enabled in the test fixture's tuwunel.toml.
    const reg = await fetch(`${HS_URL}/_matrix/client/v3/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth: { type: "m.login.dummy" },
        username,
        password,
        inhibit_login: false,
      }),
    });
    if (!reg.ok) {
      throw new Error(`human registration failed: ${reg.status} ${await reg.text()}`);
    }
    const j = (await reg.json()) as { user_id: string; access_token: string };
    await use({ userId: j.user_id, accessToken: j.access_token, username, password });
  },

  daemon: async ({}, use) => {
    const localpart = `${AS_NAMESPACE_PREFIX}architect_${randomUUID().slice(0, 8)}`;
    // AS-namespaced users are registered via /register with the AS token,
    // type m.login.application_service. No password, no captcha.
    const reg = await fetch(
      `${HS_URL}/_matrix/client/v3/register?access_token=${encodeURIComponent(AS_TOKEN)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "m.login.application_service",
          username: localpart,
        }),
      },
    );
    if (!reg.ok) {
      throw new Error(`AS user registration failed: ${reg.status} ${await reg.text()}`);
    }
    const j = (await reg.json()) as { user_id: string };
    const agentUserId = j.user_id;

    // AS-impersonating client: AS_TOKEN as bearer + ?user_id= on every request.
    const agentClient = createClient({
      baseUrl: HS_URL,
      accessToken: AS_TOKEN,
      userId: agentUserId,
      queryParams: { user_id: agentUserId },
    });
    await agentClient.startClient({ initialSyncLimit: 0 });

    const impersonator: DaemonImpersonator = {
      agentClient,
      agentUserId,

      async createRoomWithHuman(humanUserId) {
        // Default PL: creator (agent) gets 100, invitee defaults to 0. That's
        // fine for the e2e — eco.zoon.approval_response gates at events_default
        // (0) per the Permissions section of the spec, so the human can
        // respond with PL 0.
        const { room_id } = await agentClient.createRoom({
          preset: "private_chat",
          invite: [humanUserId],
        });
        return room_id;
      },

      async sendApprovalRequest(roomId, opts) {
        const approvalId = randomUUID();
        const res = await (agentClient.sendEvent as (
          roomId: string,
          type: string,
          content: Record<string, unknown>,
        ) => Promise<{ event_id: string }>)(roomId, "eco.zoon.approval_request", {
          approval_id: approvalId,
          session_id: opts.sessionId,
          tool_call_id: opts.toolCallId,
          options: [
            { id: "allow", label: "Allow" },
            { id: "cancel", label: "Cancel" },
          ],
        });
        return { approvalId, eventId: res.event_id };
      },

      async waitForApprovalResponse(roomId, approvalId, timeoutMs = 15_000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const room = agentClient.getRoom(roomId);
          const events = room?.getLiveTimeline().getEvents() ?? [];
          for (const ev of events) {
            if (ev.getType() !== "eco.zoon.approval_response") continue;
            const c = ev.getContent() as { approval_id?: string; decision?: string };
            if (c.approval_id === approvalId && typeof c.decision === "string") {
              return { decision: c.decision, sender: ev.getSender() ?? "?" };
            }
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        throw new Error(
          `Timed out waiting for approval_response with approval_id=${approvalId}`,
        );
      },
    };

    try {
      await use(impersonator);
    } finally {
      agentClient.stopClient();
    }
  },
});

export const expect = test.expect;
