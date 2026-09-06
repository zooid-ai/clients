import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConditionKind,
  PushRuleActionName,
  PushRuleKind,
  type IPushRule,
  type MatrixClient,
} from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";
import { makeFakeClient } from "../../../test/factories";
import {
  addKeyword,
  AGENT_RULE_IDS,
  ensureAgentPushRules,
  getAgentRulesEnabled,
  getGlobalNotifMode,
  getKeywords,
  getMutedUsers,
  getRoomNotifState,
  removeKeyword,
  setAgentRulesEnabled,
  setGlobalNotifMode,
  setRoomNotifState,
  setUserMuted,
} from "./notification-prefs";

const roomId = "!r:h.example";
const me = "@me:h.example";
const noisy = "@agent:h.example";

type RuleSeed = Partial<Record<"override" | "content" | "room" | "sender" | "underride", IPushRule[]>>;

export function makePushClient(seed: RuleSeed = {}) {
  const client = makeFakeClient({ userId: me });
  const cast = client as unknown as Record<string, unknown>;
  cast.pushRules = {
    global: {
      override: [],
      content: [],
      room: [],
      sender: [],
      underride: [
        {
          rule_id: ".m.rule.message",
          default: true,
          enabled: true,
          actions: [PushRuleActionName.Notify],
        },
      ],
      ...seed,
    },
  };
  cast.setRoomMutePushRule = vi.fn(async () => {});
  cast.addPushRule = vi.fn(async () => ({}));
  cast.deletePushRule = vi.fn(async () => ({}));
  cast.setPushRuleEnabled = vi.fn(async () => ({}));
  cast.getPushRules = vi.fn(async () => cast.pushRules);
  cast.setPushRules = vi.fn((rules: unknown) => {
    cast.pushRules = rules;
  });
  return client as MatrixClient;
}

function roomMentionsRule(): IPushRule {
  return {
    rule_id: roomId,
    default: false,
    enabled: true,
    actions: [PushRuleActionName.DontNotify],
  };
}

function roomMuteOverride(): IPushRule {
  return {
    rule_id: roomId,
    default: false,
    enabled: true,
    conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomId }],
    actions: [PushRuleActionName.DontNotify],
  };
}

function userMuteOverride(userId: string): IPushRule {
  return {
    rule_id: userId,
    default: false,
    enabled: true,
    conditions: [{ kind: ConditionKind.EventMatch, key: "sender", pattern: userId }],
    actions: [PushRuleActionName.DontNotify],
  };
}

afterEach(() => MatrixClientPeg.reset());

describe("getRoomNotifState", () => {
  it("defaults to all", () => {
    expect(getRoomNotifState(makePushClient(), roomId)).toBe("all");
  });

  it("reads a room-kind dont_notify rule as mentions", () => {
    const client = makePushClient({ room: [roomMentionsRule()] });
    expect(getRoomNotifState(client, roomId)).toBe("mentions");
  });

  it("reads a room_id override rule as mute, even with a room rule present", () => {
    const client = makePushClient({
      override: [roomMuteOverride()],
      room: [roomMentionsRule()],
    });
    expect(getRoomNotifState(client, roomId)).toBe("mute");
  });

  it("ignores user-mute overrides (different rule shape)", () => {
    const client = makePushClient({ override: [userMuteOverride(noisy)] });
    expect(getRoomNotifState(client, roomId)).toBe("all");
  });
});

describe("setRoomNotifState", () => {
  it("mentions: delegates to setRoomMutePushRule(true)", async () => {
    const client = makePushClient();
    await setRoomNotifState(client, roomId, "mentions");
    expect(client.setRoomMutePushRule).toHaveBeenCalledWith("global", roomId, true);
    expect(client.addPushRule).not.toHaveBeenCalled();
  });

  it("mute: adds a room_id override and clears any room rule", async () => {
    const client = makePushClient({ room: [roomMentionsRule()] });
    await setRoomNotifState(client, roomId, "mute");
    expect(client.addPushRule).toHaveBeenCalledWith(
      "global",
      PushRuleKind.Override,
      roomId,
      expect.objectContaining({
        conditions: [{ kind: ConditionKind.EventMatch, key: "room_id", pattern: roomId }],
        actions: [PushRuleActionName.DontNotify],
      }),
    );
    expect(client.setRoomMutePushRule).toHaveBeenCalledWith("global", roomId, false);
  });

  it("all: removes both rule shapes", async () => {
    const client = makePushClient({
      override: [roomMuteOverride()],
      room: [roomMentionsRule()],
    });
    await setRoomNotifState(client, roomId, "all");
    expect(client.deletePushRule).toHaveBeenCalledWith(
      "global",
      PushRuleKind.Override,
      roomId,
    );
    expect(client.setRoomMutePushRule).toHaveBeenCalledWith("global", roomId, false);
  });

  it("refetches push rules after mutating", async () => {
    const client = makePushClient();
    await setRoomNotifState(client, roomId, "mentions");
    expect(client.getPushRules).toHaveBeenCalled();
    expect(client.setPushRules).toHaveBeenCalled();
  });
});

describe("muted users", () => {
  it("lists only sender-condition override mutes", () => {
    const client = makePushClient({
      override: [userMuteOverride(noisy), roomMuteOverride()],
    });
    expect(getMutedUsers(client)).toEqual([noisy]);
  });

  it("mute adds an override rule keyed by user ID", async () => {
    const client = makePushClient();
    await setUserMuted(client, noisy, true);
    expect(client.addPushRule).toHaveBeenCalledWith(
      "global",
      PushRuleKind.Override,
      noisy,
      expect.objectContaining({
        conditions: [{ kind: "event_match", key: "sender", pattern: noisy }],
        actions: [PushRuleActionName.DontNotify],
      }),
    );
  });

  it("unmute deletes the override rule", async () => {
    const client = makePushClient({ override: [userMuteOverride(noisy)] });
    await setUserMuted(client, noisy, false);
    expect(client.deletePushRule).toHaveBeenCalledWith(
      "global",
      PushRuleKind.Override,
      noisy,
    );
  });
});

describe("global mode", () => {
  it("reads enabled .m.rule.message as all", () => {
    expect(getGlobalNotifMode(makePushClient())).toBe("all");
  });

  it("reads disabled .m.rule.message as mentions", () => {
    const client = makePushClient({
      underride: [
        {
          rule_id: ".m.rule.message",
          default: true,
          enabled: false,
          actions: [PushRuleActionName.Notify],
        },
      ],
    });
    expect(getGlobalNotifMode(client)).toBe("mentions");
  });

  it("setGlobalNotifMode toggles the underride rule", async () => {
    const client = makePushClient();
    await setGlobalNotifMode(client, "mentions");
    expect(client.setPushRuleEnabled).toHaveBeenCalledWith(
      "global",
      PushRuleKind.Underride,
      ".m.rule.message",
      false,
    );
  });
});

describe("keywords", () => {
  it("lists non-default content rules", () => {
    const client = makePushClient({
      content: [
        {
          rule_id: "deploy",
          pattern: "deploy",
          default: false,
          enabled: true,
          actions: [PushRuleActionName.Notify],
        },
        {
          rule_id: ".m.rule.contains_user_name",
          pattern: "me",
          default: true,
          enabled: true,
          actions: [PushRuleActionName.Notify],
        },
      ],
    });
    expect(getKeywords(client)).toEqual(["deploy"]);
  });

  it("addKeyword creates a highlighting content rule", async () => {
    const client = makePushClient();
    await addKeyword(client, "deploy");
    expect(client.addPushRule).toHaveBeenCalledWith(
      "global",
      PushRuleKind.ContentSpecific,
      "deploy",
      expect.objectContaining({ pattern: "deploy" }),
    );
  });

  it("removeKeyword deletes the content rule", async () => {
    const client = makePushClient();
    await removeKeyword(client, "deploy");
    expect(client.deletePushRule).toHaveBeenCalledWith(
      "global",
      PushRuleKind.ContentSpecific,
      "deploy",
    );
  });
});

describe("agent push rules", () => {
  function clientWithPushRules() {
    const addPushRule = vi.fn().mockResolvedValue({});
    const client = makeFakeClient({ userId: "@me:example.org" }) as unknown as Record<string, unknown>;
    client.addPushRule = addPushRule;
    client.getPushRules = vi.fn().mockResolvedValue({ global: { override: [], underride: [] } });
    client.setPushRules = vi.fn();
    return { client: client as unknown as MatrixClient, addPushRule };
  }

  it("installs all three rules as plain overrides — no before/after, which Matrix forbids against a server-default rule", async () => {
    const { client, addPushRule } = clientWithPushRules();
    await ensureAgentPushRules(client);

    const ids = addPushRule.mock.calls.map((c) => c[2]);
    expect(ids).toEqual(["dev.zooid.approval_request", "dev.zooid.turn.end", "dev.zooid.error"]);
    for (const call of addPushRule.mock.calls) {
      expect(call[0]).toBe("global");
      expect(call[1]).toBe(PushRuleKind.Override);
    }
  });

  it("matches on event type", async () => {
    const { client, addPushRule } = clientWithPushRules();
    await ensureAgentPushRules(client);
    const body = addPushRule.mock.calls[0]![3] as { conditions: unknown[] };
    expect(body.conditions).toEqual([
      { kind: "event_match", key: "type", pattern: "dev.zooid.approval_request" },
    ]);
  });

  it("puts a sound tweak on turn.end and on nothing else", async () => {
    const { client, addPushRule } = clientWithPushRules();
    await ensureAgentPushRules(client);
    const actionsFor = (id: string) =>
      (addPushRule.mock.calls.find((c) => c[2] === id)![3] as { actions: unknown[] }).actions;

    expect(actionsFor("dev.zooid.turn.end")).toEqual([
      "notify",
      { set_tweak: "sound", value: "default" },
    ]);
    expect(actionsFor("dev.zooid.approval_request")).toEqual([
      "notify",
      { set_tweak: "highlight", value: true },
    ]);
    expect(actionsFor("dev.zooid.error")).toEqual(["notify"]);
  });

  it("is idempotent — re-running does not duplicate", async () => {
    const { client, addPushRule } = clientWithPushRules();
    (client as unknown as Record<string, unknown>).pushRules = {
      global: { override: AGENT_RULE_IDS.map((id) => ({ rule_id: id, enabled: true, actions: ["notify"] })) },
    };
    await ensureAgentPushRules(client);
    expect(addPushRule).not.toHaveBeenCalled();
  });

  it("reads and writes the enabled state per rule", async () => {
    const { client } = clientWithPushRules();
    (client as unknown as Record<string, unknown>).pushRules = {
      global: { override: [{ rule_id: "dev.zooid.turn.end", enabled: false, actions: ["notify"] }] },
    };
    expect(getAgentRulesEnabled(client)["dev.zooid.turn.end"]).toBe(false);

    client.setPushRuleEnabled = vi.fn().mockResolvedValue({});
    await setAgentRulesEnabled(client, "dev.zooid.turn.end", true);
    expect(client.setPushRuleEnabled).toHaveBeenCalledWith("global", "override", "dev.zooid.turn.end", true);
  });
});
