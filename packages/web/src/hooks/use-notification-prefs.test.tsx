import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConditionKind, PushRuleActionName } from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";
import { makePushClient } from "@/lib/matrix/notification-prefs.test";
import { useNotificationPrefs } from "./use-notification-prefs";

const noisy = "@agent:h.example";

afterEach(() => MatrixClientPeg.reset());

describe("useNotificationPrefs", () => {
  it("exposes mode, keywords, and muted users from push rules", () => {
    const client = makePushClient({
      content: [
        {
          rule_id: "deploy",
          pattern: "deploy",
          default: false,
          enabled: true,
          actions: [PushRuleActionName.Notify],
        },
      ],
      override: [
        {
          rule_id: noisy,
          default: false,
          enabled: true,
          conditions: [{ kind: ConditionKind.EventMatch, key: "sender", pattern: noisy }],
          actions: [PushRuleActionName.DontNotify],
        },
      ],
    });
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useNotificationPrefs());
    expect(result.current.mode).toBe("all");
    expect(result.current.keywords).toEqual(["deploy"]);
    expect(result.current.mutedUsers).toEqual([noisy]);
  });

  it("mutations call through and refetch", async () => {
    const client = makePushClient();
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useNotificationPrefs());
    await act(() => result.current.addKeyword("deploy"));
    expect(client.addPushRule).toHaveBeenCalled();
    expect(client.getPushRules).toHaveBeenCalled();
  });

  it("exposes agent rule enabled state, defaulting to on", () => {
    const client = makePushClient();
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useNotificationPrefs());
    expect(result.current.agentRulesEnabled["dev.zooid.turn.end"]).toBe(true);
  });

  it("setAgentRuleEnabled calls through to setPushRuleEnabled", async () => {
    const client = makePushClient();
    MatrixClientPeg.injectClientForTest(client);
    const { result } = renderHook(() => useNotificationPrefs());
    await act(() => result.current.setAgentRuleEnabled("dev.zooid.turn.end", false));
    expect(client.setPushRuleEnabled).toHaveBeenCalledWith(
      "global",
      "override",
      "dev.zooid.turn.end",
      false,
    );
  });
});
