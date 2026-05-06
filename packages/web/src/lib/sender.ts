/**
 * `@docs:localhost` → `docs`. Falls back to the input if it isn't a Matrix
 * user ID.
 */
export function displayNameOf(userId: string): string {
  const m = /^@([^:]+):/.exec(userId);
  return m ? m[1] : userId;
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
 * Split a message body into alternating plain-text and user-id segments so
 * mentions can be highlighted in the timeline.
 */
export function splitMentions(body: string): { text: string; userId: string | null }[] {
  const parts = body.split(USER_ID_SPLIT);
  return parts.map((p) => (USER_ID_TEST.test(p) ? { text: p, userId: p } : { text: p, userId: null }));
}
