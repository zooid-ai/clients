import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayNameOf, expandMentions, nameOfMember, senderColor } from "@/lib/sender";
import { listSlashCommands, parseSlashCommand, type SlashCommandMeta } from "@/lib/slash-commands";
import { useMatrixClient } from "../../hooks/use-matrix-client";
import { useMembers } from "../../hooks/use-members";
import { useThreadPreview } from "../../hooks/use-timeline";

const TEXTAREA_CLS =
  "field-sizing-content min-h-9 flex-1 bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground resize-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const INPUT_WRAPPER_CLS =
  "flex items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30 pr-1.5";

interface Member {
  userId: string;
  name: string;
}

type AcMode = "mention" | "slash";

interface AutocompleteState {
  mode: AcMode;
  start: number;
  query: string;
}

function truncate(s: string, max: number): string {
  const trimmed = s.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1) + "…" : trimmed;
}

export interface ComposerProps {
  roomId: string;
  threadRootEventId?: string | null;
  onExitThread?: () => void;
}

export function Composer({ roomId, threadRootEventId, onExitThread }: ComposerProps) {
  const client = useMatrixClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ac, setAc] = useState<AutocompleteState | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const threadScoped = Boolean(threadRootEventId);
  const threadId = threadRootEventId ?? null;

  // Get the last message in the thread for the "Replying to" banner.
  // Always call the hook (avoids conditional hook rules); returns empty when rootEventId is ''.
  const threadPreview = useThreadPreview(roomId, threadRootEventId ?? "");
  const lastThreadEvent = threadPreview.events.at(-1);
  const replyingToBody = useMemo(() => {
    // Prefer the most-recent reply; fall back to the root event itself.
    if (lastThreadEvent) {
      return (lastThreadEvent.getContent() as { body?: string }).body ?? "";
    }
    if (!threadRootEventId) return "";
    const room = client?.getRoom(roomId);
    const rootEvt = room?.getLiveTimeline().getEvents().find((ev) => ev.getId() === threadRootEventId);
    return (rootEvt?.getContent() as { body?: string } | undefined)?.body ?? "";
  }, [lastThreadEvent, threadRootEventId, client, roomId]);

  const rawMembers = useMembers(roomId);
  const members = useMemo<Member[]>(
    () => rawMembers.map((m) => ({ userId: m.userId, name: nameOfMember(m) })),
    [rawMembers],
  );

  const slashCommands = useMemo(
    () => listSlashCommands({ threadScoped }),
    [threadScoped],
  );

  const mentionMatches = useMemo(() => {
    if (!ac || ac.mode !== "mention") return [];
    const q = ac.query.toLowerCase();
    return members
      .filter(
        (m) =>
          m.userId.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [ac, members]);

  const slashMatches = useMemo<SlashCommandMeta[]>(() => {
    if (!ac || ac.mode !== "slash") return [];
    const q = ac.query.toLowerCase();
    if (!q) return slashCommands;
    return slashCommands.filter(
      (c) => c.name.startsWith(q) || c.description.toLowerCase().includes(q),
    );
  }, [ac, slashCommands]);

  const matches = ac?.mode === "slash" ? slashMatches : mentionMatches;

  function detectAutocomplete(text: string, cursor: number) {
    // Slash command: only triggered at position 0
    if (text.startsWith("/") && cursor > 0 && !text.includes(" ")) {
      const query = text.slice(1, cursor);
      setAc((prev) => {
        if (prev?.mode === "slash" && prev.query === query) return prev;
        if (prev?.mode !== "slash" || prev.query !== query) setActiveIdx(0);
        return { mode: "slash", start: 0, query };
      });
      return;
    }

    // Mention: walk back from cursor for unclosed `@<query>` token
    let i = cursor - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "@") {
        if (i === 0 || /\s/.test(text[i - 1])) {
          const query = text.slice(i + 1, cursor);
          if (!/\s/.test(query) && !query.includes(":")) {
            setAc((prev) => {
              if (prev?.mode === "mention" && prev.start === i && prev.query === query) return prev;
              setActiveIdx(0);
              return { mode: "mention", start: i, query };
            });
            return;
          }
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i--;
    }
    setAc(null);
  }

  function selectMember(member: Member) {
    if (!ac) return;
    const before = value.slice(0, ac.start);
    const after = value.slice(ac.start + 1 + ac.query.length);
    // Insert the localpart, not the displayname — the body must stay
    // mxid-tokenizable so expandMentions() can resolve it. The dropdown
    // shows the displayname so users see what they're picking.
    const insert = `@${displayNameOf(member.userId)} `;
    const next = before + insert + after;
    setValue(next);
    setAc(null);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const pos = before.length + insert.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function selectSlash(cmd: SlashCommandMeta) {
    const next = `/${cmd.name} `;
    setValue(next);
    setAc(null);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(next.length, next.length);
    });
  }

  type SendEvent = (
    roomId: string,
    threadId: string | null,
    type: string,
    content: Record<string, unknown>,
  ) => Promise<{ event_id: string }>;

  async function send(): Promise<void> {
    const body = value.trim();
    if (!body) return;
    setError(null);
    try {
      const slash = parseSlashCommand(body, { threadScoped });
      if (slash) {
        // matrix-js-sdk auto-adds m.relates_to for m.room.message threaded
        // sends, but not for custom event types (eco.zoon.*). Set the
        // relation explicitly so the daemon can route by thread root.
        const slashContent = threadId
          ? {
              ...slash.content,
              "m.relates_to": { rel_type: "m.thread", event_id: threadId },
            }
          : slash.content;
        await (client.sendEvent as unknown as SendEvent).call(
          client,
          roomId,
          threadId,
          slash.eventType,
          slashContent,
        );
        setValue("");
        return;
      }
      const { body: expandedBody, userIds: mentionUserIds } = expandMentions(body, members);
      const content: Record<string, unknown> = { msgtype: "m.text", body: expandedBody };
      if (mentionUserIds.length > 0) {
        content["m.mentions"] = { user_ids: mentionUserIds };
      }
      await (client.sendEvent as unknown as SendEvent).call(
        client,
        roomId,
        threadId,
        "m.room.message",
        content,
      );
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const onKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (ac && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (ac.mode === "slash") {
          const activeCmd = slashMatches[activeIdx] as SlashCommandMeta | undefined;
          // If the user typed the full command and pressed Enter, send immediately.
          if (activeCmd && e.key === "Enter" && value.trim() === `/${activeCmd.name}`) {
            setAc(null);
            await send();
          } else {
            selectSlash(activeCmd as SlashCommandMeta);
          }
        } else {
          selectMember(mentionMatches[activeIdx] as Member);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAc(null);
        return;
      }
    }
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    await send();
  };

  return (
    <div className="relative shrink-0 border-t border-border p-3">
      {error && (
        <div role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {threadRootEventId && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 min-w-0">
          <span className="shrink-0">Replying to</span>
          {replyingToBody ? (
            <span className="truncate italic text-foreground/70">
              "{truncate(replyingToBody, 60)}"
            </span>
          ) : (
            <span className="h-3 w-32 rounded bg-muted animate-pulse" aria-busy="true" />
          )}
          <button
            type="button"
            aria-label="Exit thread"
            onClick={() => onExitThread?.()}
            className="ml-auto shrink-0 rounded px-2 py-1 hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}
      {ac && matches.length > 0 && (
        <ul
          role="listbox"
          aria-label={ac.mode === "slash" ? "Command suggestions" : "Mention suggestions"}
          className="absolute bottom-full left-3 right-3 mb-1 max-h-56 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {ac.mode === "slash"
            ? slashMatches.map((cmd, i) => (
                <li
                  key={cmd.name}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSlash(cmd);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={
                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm " +
                    (i === activeIdx ? "bg-accent text-accent-foreground" : "")
                  }
                >
                  <span className="font-mono font-semibold text-primary">/{cmd.name}</span>
                  <span className="text-xs text-muted-foreground">{cmd.description}</span>
                </li>
              ))
            : mentionMatches.map((m, i) => (
                <li
                  key={m.userId}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectMember(m);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={
                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm " +
                    (i === activeIdx ? "bg-accent text-accent-foreground" : "")
                  }
                >
                  <span className="font-semibold" style={{ color: senderColor(m.userId) }}>
                    {m.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.userId}</span>
                </li>
              ))}
        </ul>
      )}
      <div className={INPUT_WRAPPER_CLS}>
        <textarea
          ref={textareaRef}
          data-slot="textarea"
          aria-label="Message"
          placeholder="Send a message…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            detectAutocomplete(e.target.value, e.target.selectionStart);
          }}
          onKeyUp={(e) => {
            if (ac && (e.key === "ArrowDown" || e.key === "ArrowUp")) return;
            if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
              const ta = e.currentTarget;
              detectAutocomplete(ta.value, ta.selectionStart);
            }
          }}
          onClick={(e) => {
            const ta = e.currentTarget;
            detectAutocomplete(ta.value, ta.selectionStart);
          }}
          onBlur={() => setAc(null)}
          onKeyDown={onKeyDown}
          rows={1}
          className={cn(TEXTAREA_CLS)}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!value.trim()}
          aria-label="Send message"
          className="shrink-0 self-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
