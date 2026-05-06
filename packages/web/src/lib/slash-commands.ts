/**
 * Slash command registry. Each entry maps user-typed `/<name>` (with optional
 * arguments) to a custom matrix event type + content shape. Send via the
 * 4-arg `client.sendEvent(roomId, null, type, content)` overload.
 */

export interface ParsedSlashCommand {
  /** Custom matrix event type, e.g. "eco.zoon.session_reset". */
  eventType: string;
  /** Event content payload. */
  content: Record<string, unknown>;
}

interface SlashCommandSpec {
  names: string[];
  build: (args: string) => ParsedSlashCommand;
}

const COMMANDS: SlashCommandSpec[] = [
  {
    names: ["clear", "new"],
    build: () => ({ eventType: "eco.zoon.session_reset", content: {} }),
  },
];

/**
 * Returns the parsed command if `body` starts with a slash and matches a
 * registered command. `null` for plain messages or unknown slashes — those
 * still flow through as a regular m.room.message so users see "what they typed."
 */
export function parseSlashCommand(body: string): ParsedSlashCommand | null {
  if (!body.startsWith("/")) return null;
  const space = body.indexOf(" ");
  const name = (space === -1 ? body.slice(1) : body.slice(1, space)).toLowerCase();
  const args = space === -1 ? "" : body.slice(space + 1).trim();
  for (const spec of COMMANDS) {
    if (spec.names.includes(name)) return spec.build(args);
  }
  return null;
}
