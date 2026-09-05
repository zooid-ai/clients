import { useCallback, useMemo, useSyncExternalStore } from "react";
import { MatrixClientPeg } from "@/client/peg";
import {
  addKeyword as addKeywordRule,
  AGENT_RULE_IDS,
  getAgentRulesEnabled,
  getGlobalNotifMode,
  getKeywords,
  getMutedUsers,
  removeKeyword as removeKeywordRule,
  setAgentRulesEnabled,
  setGlobalNotifMode,
  setUserMuted,
  subscribePushRules,
  type GlobalNotifMode,
} from "@/lib/matrix/notification-prefs";

const EMPTY_AGENT_RULES = Object.fromEntries(AGENT_RULE_IDS.map((id) => [id, true]));
const EMPTY = JSON.stringify({ mode: "all", keywords: [], mutedUsers: [], agentRulesEnabled: EMPTY_AGENT_RULES });

export function useNotificationPrefs() {
  const json = useSyncExternalStore(
    (cb) => {
      const client = MatrixClientPeg.safeGet();
      const unsubPeg = MatrixClientPeg.subscribe(cb);
      if (!client) return unsubPeg;
      const unsubRules = subscribePushRules(client, cb);
      return () => {
        unsubRules();
        unsubPeg();
      };
    },
    () => {
      const client = MatrixClientPeg.safeGet();
      if (!client) return EMPTY;
      return JSON.stringify({
        mode: getGlobalNotifMode(client),
        keywords: getKeywords(client),
        mutedUsers: getMutedUsers(client),
        agentRulesEnabled: getAgentRulesEnabled(client),
      });
    },
    () => EMPTY,
  );

  const { mode, keywords, mutedUsers, agentRulesEnabled } = useMemo(
    () =>
      JSON.parse(json) as {
        mode: GlobalNotifMode;
        keywords: string[];
        mutedUsers: string[];
        agentRulesEnabled: Record<string, boolean>;
      },
    [json],
  );

  const withClient = useCallback(
    async (fn: (client: NonNullable<ReturnType<typeof MatrixClientPeg.safeGet>>) => Promise<void>) => {
      const client = MatrixClientPeg.safeGet();
      if (client) await fn(client);
    },
    [],
  );

  return {
    mode,
    keywords,
    mutedUsers,
    agentRulesEnabled,
    setMode: (m: GlobalNotifMode) => withClient((c) => setGlobalNotifMode(c, m)),
    addKeyword: (k: string) => withClient((c) => addKeywordRule(c, k)),
    removeKeyword: (k: string) => withClient((c) => removeKeywordRule(c, k)),
    muteUser: (u: string) => withClient((c) => setUserMuted(c, u, true)),
    unmuteUser: (u: string) => withClient((c) => setUserMuted(c, u, false)),
    setAgentRuleEnabled: (ruleId: (typeof AGENT_RULE_IDS)[number], enabled: boolean) =>
      withClient((c) => setAgentRulesEnabled(c, ruleId, enabled)),
  };
}
