import type { RoomMember } from "matrix-js-sdk";

/**
 * `@docs:localhost` → `docs`. Falls back to the input if it isn't a Matrix
 * user ID.
 */
export function displayNameOf(userId: string): string {
  const m = /^@([^:]+):/.exec(userId);
  return m ? m[1] : userId;
}

/**
 * Resolve a room member's visible name. Prefers matrix-js-sdk's calculated
 * `.name` (which folds in profile displayname, per-room override, and
 * disambiguation suffixes); falls back to the user_id localpart.
 */
export function nameOfMember(member: RoomMember): string {
  return member.name || displayNameOf(member.userId);
}

/**
 * Deterministic HSL color for a Matrix user ID. Same input → same hue every
 * time, so a given sender keeps the same color across renders and reloads.
 * Saturation/lightness are tuned for the dark theme.
 */
export function senderColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue} 70% 72%)`;
}

const USER_ID_SPLIT = /(@[A-Za-z0-9._\-=/+]+:[A-Za-z0-9.\-]+)/g;
const USER_ID_TEST = /^@[A-Za-z0-9._\-=/+]+:[A-Za-z0-9.\-]+$/;

/**
 * Expand short-form `@localpart` mentions to full mxids using the supplied
 * member directory, and collect the union of mentioned mxids (short and full)
 * for `m.mentions.user_ids`.
 *
 * - Short form is matched on word boundaries (`@docs`, `@ux-consultant`) to
 *   avoid catching email-like text (`foo@bar.com`).
 * - Already-full mxids in the body (`@docs:localhost`) are left untouched but
 *   still included in the returned userIds.
 * - Unmatched `@xxx` tokens are left as plain text.
 */
export function expandMentions(
  body: string,
  members: ReadonlyArray<{ userId: string }>,
): { body: string; userIds: string[] } {
  const byLocalpart = new Map<string, string>();
  for (const m of members) {
    const lp = displayNameOf(m.userId);
    if (lp !== m.userId && !byLocalpart.has(lp)) byLocalpart.set(lp, m.userId);
  }

  const userIds = new Set<string>();
  for (const match of body.match(USER_ID_SPLIT) ?? []) userIds.add(match);

  const SHORT_MENTION = /(^|\s)@([A-Za-z0-9._\-=/+]+)(?!:[A-Za-z0-9.\-])/g;
  const expanded = body.replace(SHORT_MENTION, (whole, pre: string, name: string) => {
    const mxid = byLocalpart.get(name);
    if (!mxid) return whole;
    userIds.add(mxid);
    return `${pre}${mxid}`;
  });

  return { body: expanded, userIds: Array.from(userIds) };
}

/**
 * Split a message body into alternating plain-text and user-id segments so
 * mentions can be highlighted in the timeline.
 */
export function splitMentions(body: string): { text: string; userId: string | null }[] {
  const parts = body.split(USER_ID_SPLIT);
  return parts.map((p) => (USER_ID_TEST.test(p) ? { text: p, userId: p } : { text: p, userId: null }));
}
