import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  notificationsEnabledLocally,
  setNotificationsEnabledLocally,
} from "@/hooks/use-notifications";
import { useNotificationPrefs } from "@/hooks/use-notification-prefs";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { AGENT_RULE_IDS } from "@/lib/matrix/notification-prefs";
import { setSoundEnabledLocally, soundEnabledLocally } from "@/lib/notification-sound";
import type { GlobalNotifMode } from "@/lib/matrix/notification-prefs";

const AGENT_RULE_LABELS: Record<string, string> = {
  "dev.zooid.approval_request": "Approval requests",
  "dev.zooid.turn.end": "Agent finished a turn",
  "dev.zooid.error": "Agent errors",
};

export interface NotificationSectionViewProps {
  permission: NotificationPermission;
  pushSupported: boolean;
  /** Whether a browser PushSubscription is currently registered — the source of truth for whether push actually works, independent of `permission`. */
  subscribed: boolean;
  subscribeError?: string | null;
  onEnable: () => void;
  localEnabled: boolean;
  onToggleLocalEnabled: () => void;
  mode: GlobalNotifMode;
  onSetMode: (m: GlobalNotifMode) => void;
  keywords: string[];
  keywordInput: string;
  onKeywordInputChange: (v: string) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (k: string) => void;
  mutedUsers: string[];
  muteInput: string;
  onMuteInputChange: (v: string) => void;
  onMuteUser: () => void;
  onUnmuteUser: (u: string) => void;
  agentRulesEnabled: Record<string, boolean>;
  onSetAgentRuleEnabled: (ruleId: string, enabled: boolean) => void;
  soundEnabled: boolean;
  onSetSoundEnabled: (enabled: boolean) => void;
}

/** Pure, prop-fed view — storied without a live MatrixClient or a browser permission. */
export function NotificationSectionView({
  permission,
  pushSupported,
  subscribed,
  subscribeError,
  onEnable,
  localEnabled,
  onToggleLocalEnabled,
  mode,
  onSetMode,
  keywords,
  keywordInput,
  onKeywordInputChange,
  onAddKeyword,
  onRemoveKeyword,
  mutedUsers,
  muteInput,
  onMuteInputChange,
  onMuteUser,
  onUnmuteUser,
  agentRulesEnabled,
  onSetAgentRuleEnabled,
  soundEnabled,
  onSetSoundEnabled,
}: NotificationSectionViewProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">This browser</p>
        {permission === "default" && (
          <Button size="sm" variant="outline" onClick={onEnable}>
            Enable notifications
          </Button>
        )}
        {permission === "denied" && (
          <p className="text-xs text-muted-foreground">
            Blocked — re-enable in browser site settings.
          </p>
        )}
        {permission === "granted" && !pushSupported && (
          <p className="text-xs text-muted-foreground">
            Push notifications aren&apos;t configured on this server — you&apos;ll still see
            notifications while a tab is open.
          </p>
        )}
        {/* The bug this branch exists to fix: permission can already be
            "granted" from before this feature existed (or from the in-page
            fallback alone), with no PushSubscription ever created — gating
            only on `permission === "default"` above would leave that user
            with no way to finish enabling push. */}
        {permission === "granted" && pushSupported && !subscribed && (
          <Button size="sm" variant="outline" onClick={onEnable}>
            Enable notifications
          </Button>
        )}
        {subscribeError && <p className="text-xs text-destructive">{subscribeError}</p>}
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={localEnabled}
          onClick={onToggleLocalEnabled}
        >
          Notifications in this browser
        </Button>
      </div>

      {subscribed && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Agent notifications</p>
          {AGENT_RULE_IDS.map((id) => {
            const enabled = agentRulesEnabled[id] ?? false;
            return (
              <Button
                key={id}
                size="sm"
                variant={enabled ? "secondary" : "outline"}
                aria-pressed={enabled}
                onClick={() => onSetAgentRuleEnabled(id, !enabled)}
                className="flex w-full justify-between"
              >
                {AGENT_RULE_LABELS[id] ?? id}
                <span className="text-xs text-muted-foreground">{enabled ? "On" : "Off"}</span>
              </Button>
            );
          })}
          <Button
            size="sm"
            variant={soundEnabled ? "secondary" : "outline"}
            aria-pressed={soundEnabled}
            onClick={() => onSetSoundEnabled(!soundEnabled)}
            className="flex w-full justify-between"
          >
            Sound when an agent finishes (this browser only)
            <span className="text-xs text-muted-foreground">{soundEnabled ? "On" : "Off"}</span>
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Notify me about</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "all" ? "default" : "outline"}
            aria-pressed={mode === "all"}
            onClick={() => onSetMode("all")}
          >
            All messages
          </Button>
          <Button
            size="sm"
            variant={mode === "mentions" ? "default" : "outline"}
            aria-pressed={mode === "mentions"}
            onClick={() => onSetMode("mentions")}
          >
            Mentions, DMs &amp; keywords
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notif-keyword">Keyword</Label>
        <div className="flex gap-2">
          <Input
            id="notif-keyword"
            value={keywordInput}
            onChange={(e) => onKeywordInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAddKeyword();
            }}
            placeholder="e.g. deploy"
            className="h-7 text-sm"
          />
          <Button size="sm" onClick={onAddKeyword}>
            Add
          </Button>
        </div>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="gap-1">
                {kw}
                <button
                  type="button"
                  aria-label={`Remove keyword ${kw}`}
                  className="ml-1 hover:text-foreground"
                  onClick={() => onRemoveKeyword(kw)}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notif-mute-user">Mute a user</Label>
        <div className="flex gap-2">
          <Input
            id="notif-mute-user"
            value={muteInput}
            onChange={(e) => onMuteInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onMuteUser();
            }}
            placeholder="@user:server"
            className="h-7 text-sm"
          />
          <Button size="sm" onClick={onMuteUser}>
            Mute
          </Button>
        </div>
        {mutedUsers.length > 0 && (
          <div className="space-y-1">
            {mutedUsers.map((u) => (
              <div key={u} className="flex items-center justify-between text-sm">
                <span className="truncate text-muted-foreground">{u}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 shrink-0 px-2 text-xs"
                  onClick={() => onUnmuteUser(u)}
                >
                  Unmute
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationSection({
  pushGatewayUrl,
  vapidPublicKey,
}: {
  pushGatewayUrl?: string;
  vapidPublicKey?: string;
}) {
  const [localEnabled, setLocalEnabled] = useState(notificationsEnabledLocally);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  const [keywordInput, setKeywordInput] = useState("");
  const [muteInput, setMuteInput] = useState("");
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(soundEnabledLocally);
  const {
    mode,
    keywords,
    mutedUsers,
    agentRulesEnabled,
    setMode,
    addKeyword,
    removeKeyword,
    muteUser,
    unmuteUser,
    setAgentRuleEnabled,
  } = useNotificationPrefs();
  const push = usePushSubscription({
    push_gateway_url: pushGatewayUrl,
    vapid_public_key: vapidPublicKey,
  });

  function toggleLocalEnabled() {
    const next = !localEnabled;
    setLocalEnabled(next);
    setNotificationsEnabledLocally(next);
  }

  async function handleEnable() {
    setSubscribeError(null);
    try {
      await push.enable();
    } catch {
      setSubscribeError("Couldn't turn on push notifications. Try again in a moment.");
    }
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }

  async function handleAddKeyword() {
    if (!keywordInput.trim()) return;
    await addKeyword(keywordInput.trim());
    setKeywordInput("");
  }

  async function handleMuteUser() {
    if (!muteInput.trim()) return;
    await muteUser(muteInput.trim());
    setMuteInput("");
  }

  function handleSetSoundEnabled(enabled: boolean) {
    setSoundEnabledState(enabled);
    setSoundEnabledLocally(enabled);
  }

  return (
    <NotificationSectionView
      permission={permission}
      pushSupported={push.supported}
      subscribed={push.subscribed}
      subscribeError={subscribeError}
      onEnable={() => void handleEnable()}
      localEnabled={localEnabled}
      onToggleLocalEnabled={toggleLocalEnabled}
      mode={mode}
      onSetMode={(m) => void setMode(m)}
      keywords={keywords}
      keywordInput={keywordInput}
      onKeywordInputChange={setKeywordInput}
      onAddKeyword={() => void handleAddKeyword()}
      onRemoveKeyword={(k) => void removeKeyword(k)}
      mutedUsers={mutedUsers}
      muteInput={muteInput}
      onMuteInputChange={setMuteInput}
      onMuteUser={() => void handleMuteUser()}
      onUnmuteUser={(u) => void unmuteUser(u)}
      agentRulesEnabled={agentRulesEnabled}
      onSetAgentRuleEnabled={(id, enabled) =>
        void setAgentRuleEnabled(id as (typeof AGENT_RULE_IDS)[number], enabled)
      }
      soundEnabled={soundEnabled}
      onSetSoundEnabled={handleSetSoundEnabled}
    />
  );
}
