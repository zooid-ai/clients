import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { displayNameOf, senderColor } from "@/lib/sender";
import { parseSlashCommand } from "@/lib/slash-commands";
import { useMatrixClient } from "../../hooks/use-matrix-client";

const TEXTAREA_CLS =
  "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

interface Member {
  userId: string;
  name: string;
}

interface AutocompleteState {
  start: number;
  query: string;
}

const USER_ID_IN_BODY = /@[A-Za-z0-9._\-=/+]+:[A-Za-z0-9.\-]+/g;

export function Composer({ roomId }: { roomId: string }) {
  const client = useMatrixClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ac, setAc] = useState<AutocompleteState | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const members = useMemo<Member[]>(() => {
    const room = client.getRoom(roomId);
    if (!room) return [];
    return room
      .getJoinedMembers()
      .map((m) => ({ userId: m.userId, name: m.name || displayNameOf(m.userId) }));
  }, [client, roomId]);

  const matches = useMemo(() => {
    if (!ac) return [];
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

  function detectAutocomplete(text: string, cursor: number) {
    // Walk back from the cursor for an unclosed `@<query>` token.
    let i = cursor - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "@") {
        if (i === 0 || /\s/.test(text[i - 1])) {
          const query = text.slice(i + 1, cursor);
          // Don't trigger inside a fully-formed user ID (`@a:b`) or with spaces.
          if (!/\s/.test(query) && !query.includes(":")) {
            setAc({ start: i, query });
            setActiveIdx(0);
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
    // Restore caret to just after the inserted mention.
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const pos = before.length + insert.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  async function send(): Promise<void> {
    const body = value.trim();
    if (!body) return;
    setError(null);
    // Important: call client.sendEvent directly. Extracting it via
    //   const f = client.sendEvent
    // strips the `this` binding and the SDK throws inside its own
    // `this.addThreadRelationIfNeeded(...)`. Cast inline so TS is happy with
    // both the 3-arg (m.room.message) and 4-arg (custom event w/ explicit
    // threadId) overloads.
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
        selectMember(matches[activeIdx]);
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
          aria-label="Mention suggestions"
          className="absolute bottom-full left-3 right-3 mb-1 max-h-56 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {matches.map((m, i) => (
            <li
              key={m.userId}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => {
                // mousedown so the textarea doesn't blur before we update.
                e.preventDefault();
                selectMember(m);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm " +
                (i === activeIdx ? "bg-accent text-accent-foreground" : "")
              }
            >
              <span
                className="font-semibold"
                style={{ color: senderColor(m.userId) }}
              >
                {displayNameOf(m.userId)}
              </span>
              <span className="text-xs text-muted-foreground">{m.userId}</span>
            </li>
          ))}
        </ul>
      )}
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
        rows={3}
        className={cn(TEXTAREA_CLS, "resize-none")}
      />
    </div>
  );
}
