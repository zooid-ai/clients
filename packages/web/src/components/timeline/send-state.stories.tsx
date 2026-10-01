import type { Meta } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { UserAvatar } from "@/components/user-avatar";
import { senderColor } from "@/lib/sender";
import { MessageTile } from "./message-tile";
import { MessageTimestamp } from "./message-timestamp";
import { describeSendError, SendFailure, SendingIndicator } from "./send-state";

const me = "@me:h.example";

function Row({
  body,
  state,
  reason,
}: {
  body: string;
  state: "sent" | "sending" | "failed";
  reason?: string;
}) {
  return (
    <MessageTile
      className={`hover:bg-muted/30 ${state === "failed" ? "opacity-60" : ""}`}
      avatar={<UserAvatar userId={me} size="sm" />}
      senderName="me"
      senderColor={senderColor(me)}
      senderTitle={me}
      timestamp={
        state === "failed" ? undefined : state === "sending" ? (
          <SendingIndicator />
        ) : (
          <MessageTimestamp ts={Date.now() - 20_000} />
        )
      }
    >
      <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{body}</p>
      {state === "failed" && <SendFailure reason={reason ?? ""} onRetry={fn()} onDelete={fn()} />}
    </MessageTile>
  );
}

const meta = {
  title: "Timeline/Send state",
  component: SendFailure,
  parameters: { layout: "padded" },
} satisfies Meta<typeof SendFailure>;

export default meta;

const notJoined = describeSendError({
  errcode: "M_FORBIDDEN",
  data: { error: "Auth check failed: sender's membership 'invite' is not 'join'" },
});

// Custom render ignores the SendFailure args; each story builds its tile inline.
export const Sending = {
  args: { reason: "", onRetry: fn(), onDelete: fn() },
  render: () => (
    <div className="max-w-xl">
      <Row state="sending" body="@agent can you take a look at this?" />
    </div>
  ),
};

export const FailedNotJoined = {
  args: { reason: notJoined, onRetry: fn(), onDelete: fn() },
  render: () => (
    <div className="max-w-xl">
      <Row state="failed" body="@agent can you take a look at this?" reason={notJoined} />
    </div>
  ),
};

export const FailedOtherError = {
  args: { reason: "", onRetry: fn(), onDelete: fn() },
  render: () => (
    <div className="max-w-xl">
      <Row state="failed" body="Rate limited, hold on." reason={describeSendError({ errcode: "M_LIMIT_EXCEEDED" })} />
    </div>
  ),
};

// The three states side by side with a delivered message for contrast.
export const InTimeline = {
  args: { reason: "", onRetry: fn(), onDelete: fn() },
  render: () => (
    <ol className="flex max-w-xl flex-col gap-0.5">
      <Row state="sent" body="Delivered normally." />
      <Row state="sending" body="Still in flight." />
      <Row state="failed" body="@agent can you take a look at this?" reason={notJoined} />
    </ol>
  ),
};
