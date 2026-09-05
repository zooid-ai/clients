import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotificationSectionView, type NotificationSectionViewProps } from "./notification-section";

const noop = () => {};

const base: NotificationSectionViewProps = {
  permission: "default",
  pushSupported: true,
  subscribeError: null,
  onEnable: noop,
  localEnabled: true,
  onToggleLocalEnabled: noop,
  mode: "all",
  onSetMode: noop,
  keywords: ["deploy", "incident"],
  keywordInput: "",
  onKeywordInputChange: noop,
  onAddKeyword: noop,
  onRemoveKeyword: noop,
  mutedUsers: ["@noisy-agent:h.example"],
  muteInput: "",
  onMuteInputChange: noop,
  onMuteUser: noop,
  onUnmuteUser: noop,
  agentRulesEnabled: {
    "dev.zooid.approval_request": true,
    "dev.zooid.turn.end": true,
    "dev.zooid.error": true,
  },
  onSetAgentRuleEnabled: noop,
  soundEnabled: true,
  onSetSoundEnabled: noop,
};

const meta = {
  title: "Settings/NotificationSection",
  component: NotificationSectionView,
} satisfies Meta<typeof NotificationSectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** permission `default`, push configured — the Enable button is the only entry point. */
export const Default: Story = {
  args: { ...base, permission: "default" },
};

/** permission `granted`, subscription active — agent toggles and the sound switch visible. */
export const Granted: Story = {
  args: { ...base, permission: "granted", pushSupported: true },
};

/** permission `denied` — the re-enable-in-site-settings copy, no dead Enable button. */
export const Denied: Story = {
  args: { ...base, permission: "denied" },
};

/** no push_gateway_url / vapid_public_key — explains the fallback rather than offering a broken button. */
export const PushUnconfigured: Story = {
  args: { ...base, permission: "granted", pushSupported: false },
};

/** subscribe() rejected after permission granted — the error state, which is the one users actually hit. */
export const SubscribeFailed: Story = {
  args: {
    ...base,
    permission: "granted",
    pushSupported: true,
    subscribeError: "Couldn't turn on push notifications. Try again in a moment.",
  },
};

/** approvals on, turn-end off, errors on — mixed toggles, not just all-on. */
export const AgentRulesMixed: Story = {
  args: {
    ...base,
    permission: "granted",
    pushSupported: true,
    agentRulesEnabled: {
      "dev.zooid.approval_request": true,
      "dev.zooid.turn.end": false,
      "dev.zooid.error": true,
    },
    soundEnabled: false,
  },
};

/** many keywords and muted users — wrapping and truncation. */
export const Overflow: Story = {
  args: {
    ...base,
    permission: "granted",
    pushSupported: true,
    keywords: [
      "deploy",
      "incident",
      "outage",
      "rollback",
      "on-call",
      "hotfix",
      "regression",
      "staging",
      "production",
      "database-migration",
    ],
    mutedUsers: [
      "@very-noisy-agent-with-a-long-name:h.example",
      "@another-chatty-bot:h.example",
      "@yet-another-one:some-really-long-server-name.example.org",
    ],
  },
};
