import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayNameOf, senderColor } from "@/lib/sender";
import { listSlashCommands, parseSlashCommand, type SlashCommandMeta } from "@/lib/slash-commands";
import { useMatrixClient } from "../../hooks/use-matrix-client";
import { useMembers } from "../../hooks/use-members";

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

const USER_ID_IN_BODY = /@[A-Za-z0-9._\-=/+]+:[A-Za-z0-9.\-]+/g;

const ALL_SLASH_COMMANDS = listSlashCommands();

export function Composer({ roomId }: { roomId: string }) {
  const client = useMatrixClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ac, setAc] = useState<AutocompleteState | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rawMembers = useMembers(roomId);
  const members = useMemo<Member[]>(
    () => rawMembers.map((m) => ({ userId: m.userId, name: m.name || displayNameOf(m.userId) })),
    [rawMembers],
  );

  const mentionMatches = useMemo(() => {
    if (!ac || ac.mode !== "mention") return [];
    const q = ac.query.toLowerCase();
    return members
      .filter(
        (m) =>
          m.userId.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          displayNameOf(m.userId).toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [ac, members]);

  const slashMatches = useMemo<SlashCommandMeta[]>(() => {
    if (!ac || ac.mode !== "slash") return [];
    const q = ac.query.toLowerCase();
    if (!q) return ALL_SLASH_COMMANDS;
    return ALL_SLASH_COMMANDS.filter(
      (c) => c.name.startsWith(q) || c.description.toLowerCase().includes(q),
    );
  }, [ac]);

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
              // Only reset activeIdx when the query actually changes
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
    const insert = member.userId + " ";
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

  async function send(): Promise<void> {
    const body = value.trim();
    if (!body) return;
    setError(null);
    type SendEvent3 = (
      roomId: string,
      type: string,
      content: Record<string, unknown>,
    ) => Promise<{ event_id: string }>;
    type SendEvent4 = (
      roomId: string,
      threadId: string | null,
      type: string,
      content: Record<string, unknown>,
    ) => Promise<{ event_id: string }>;
    try {
      const slash = parseSlashCommand(body);
      if (slash) {
        await (client.sendEvent as unknown as SendEvent4).call(
          client,
          roomId,
          null,
          slash.eventType,
          slash.content,
        );
        setValue("");
        return;
      }
      const mentionUserIds = Array.from(new Set(body.match(USER_ID_IN_BODY) ?? []));
      const content: Record<string, unknown> = { msgtype: "m.text", body };
      if (mentionUserIds.length > 0) {
        content["m.mentions"] = { user_ids: mentionUserIds };
      }
      await (client.sendEvent as unknown as SendEvent3).call(
        client,
        roomId,
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
          selectSlash(slashMatches[activeIdx] as SlashCommandMeta);
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
                    {displayNameOf(m.userId)}
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
            // Don't re-run autocomplete on arrow keys when the list is open —
            // onKeyDown already handled navigation; running detectAutocomplete
            // here would reset activeIdx to 0.
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
