import type { IContent, MatrixEvent } from "matrix-js-sdk";

/**
 * Resolve the effective content of `target` after m.replace edits.
 * Returns the latest valid edit's m.new_content, or null if unedited.
 * Per MSC2676, an edit is only valid from the original sender.
 */
export function resolveEditedContent(
  target: MatrixEvent,
  timeline: MatrixEvent[],
): IContent | null {
  const targetId = target.getId();
  const sender = target.getSender();
  let latest: MatrixEvent | null = null;
  for (const ev of timeline) {
    if (ev.getType() !== "m.room.message") continue;
    if (ev.isRedacted()) continue;
    if (ev.getSender() !== sender) continue;
    const rel = ev.getContent()["m.relates_to"];
    if (rel?.rel_type !== "m.replace" || rel.event_id !== targetId) continue;
    if (!ev.getContent()["m.new_content"]) continue;
    if (!latest || ev.getTs() > latest.getTs()) latest = ev;
  }
  return latest ? ((latest.getContent()["m.new_content"] as IContent) ?? null) : null;
}
