import * as React from "react";
import { cn } from "@/lib/utils";

export interface MessageTileProps extends React.ComponentProps<"div"> {
  /** Avatar node rendered in the left gutter. */
  avatar: React.ReactNode;
  senderName: React.ReactNode;
  /** Deterministic per-sender color applied to the name. */
  senderColor?: string;
  /** `title` attribute for the sender name (typically the full mxid). */
  senderTitle?: string;
  /** Absolutely-positioned hover affordances (reaction picker, edit, delete…). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The avatar-gutter + colored-name + body layout shared by every message tile.
 * Owns the interactive wrapper (hover state, selection) via passthrough props;
 * the body and an optional `actions` overlay are supplied as slots. Kept free of
 * matrix-js-sdk so Storybook and the marketing video render real message rows.
 */
export const MessageTile = React.forwardRef<HTMLDivElement, MessageTileProps>(
  function MessageTile(
    { avatar, senderName, senderColor, senderTitle, actions, children, className, ...rest },
    ref,
  ) {
    return (
      <div ref={ref} className={cn("group relative flex gap-2 py-1.5", className)} {...rest}>
        <div className="mt-0.5 shrink-0">{avatar}</div>
        <div className="min-w-0 flex-1">
          <span
            className="font-semibold text-sm leading-6"
            style={senderColor ? { color: senderColor } : undefined}
            title={senderTitle}
          >
            {senderName}
          </span>
          {children}
        </div>
        {actions}
      </div>
    );
  },
);
