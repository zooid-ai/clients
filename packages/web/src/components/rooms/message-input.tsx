import {
  forwardRef,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ImageUp, Paperclip, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayNameOf, expandMentions, nameOfMember, senderColor } from "@/lib/sender";
import { listSlashCommands, type SlashCommandMeta } from "@/lib/slash-commands";
import { useAvailableCommands } from "../../hooks/use-available-commands";
import { useMembers } from "../../hooks/use-members";
import { SlashCommandList } from "./slash-command-list";
import {
  MAX_ATTACHMENTS,
  nameClipboardFile,
  stageFiles,
  StagedAttachments,
  type StagedAttachment,
} from "./staged-attachments";

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

export interface MessageInputSubmit {
  /** The text with `@localpart` mentions expanded to full user ids. */
  body: string;
  /** The text as typed (trimmed), for callers that parse it, like slash commands. */
  rawBody: string;
  mentionUserIds: string[];
  attachments: StagedAttachment[];
  /** Replace the staged tray, e.g. with the files still unsent after a failed upload. */
  setAttachments: (next: StagedAttachment[]) => void;
}

export interface MessageInputProps {
  /** Mentions and agent slash commands resolve against this room's members. */
  roomId: string;
  /**
   * Called on Enter or the send button. The caller does the sending. The input
   * clears once it resolves; if it throws, the text stays and `onError` gets the message.
   */
  onSubmit: (submit: MessageInputSubmit) => void | Promise<void>;
  slashCommands?: boolean;
  /** Scopes the client slash commands to the ones valid inside a thread. */
  threadScoped?: boolean;
  attachments?: boolean;
  /** Which attachment is uploading, and how far along (0..1), for the tray. */
  uploadingId?: string | null;
  uploadProgress?: number;
  /** Let an empty submit through, for callers with content besides the text (a quote). */
  allowEmpty?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  /** Show the send button inside the field. */
  sendButton?: boolean;
  error?: string | null;
  onError?: (message: string | null) => void;
  /** Rendered between the error and the field, e.g. a thread banner. */
  header?: ReactNode;
  className?: string;
  /** Positioning for the suggestion list, which opens above the root. */
  suggestionsClassName?: string;
}

export interface MessageInputHandle {
  /** Submit what's typed, as if Enter were pressed. For a send button outside the input. */
  submit: () => Promise<void>;
}

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(function MessageInput({
  roomId,
  onSubmit,
  slashCommands: slashEnabled = true,
  threadScoped = false,
  attachments: attachmentsEnabled = true,
  uploadingId = null,
  uploadProgress,
  allowEmpty = false,
  disabled = false,
  placeholder = "Send a message…",
  ariaLabel = "Message",
  sendButton = true,
  error = null,
  onError,
  header,
  className,
  suggestionsClassName = "left-0 right-0",
}, ref) {
  const [value, setValue] = useState("");
  const [ac, setAc] = useState<AutocompleteState | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rawMembers = useMembers(roomId);
  const members = useMemo<Member[]>(
    () => rawMembers.map((m) => ({ userId: m.userId, name: nameOfMember(m) })),
    [rawMembers],
  );

  const advertised = useAvailableCommands(roomId);
  const slashList = useMemo(() => {
    if (!slashEnabled) return [];
    const client = listSlashCommands({ threadScoped });
    const clientNames = new Set(client.map((c) => c.name));
    const agent = advertised
      .filter((c) => !clientNames.has(c.name))
      .map((c) => ({ name: c.name, description: c.description, source: "agent" as const }));
    return [...client, ...agent];
  }, [slashEnabled, threadScoped, advertised]);

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
    if (!q) return slashList;
    return slashList.filter(
      (c) => c.name.startsWith(q) || c.description.toLowerCase().includes(q),
    );
  }, [ac, slashList]);

  const matches = ac?.mode === "slash" ? slashMatches : mentionMatches;

  function detectAutocomplete(text: string, cursor: number) {
    // Slash command: only triggered at position 0
    if (slashEnabled && text.startsWith("/") && cursor > 0 && !text.includes(" ")) {
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

  async function submit(): Promise<void> {
    const body = value.trim();
    if (disabled) return;
    if (!body && attachments.length === 0 && !allowEmpty) return;
    onError?.(null);
    try {
      const { body: expandedBody, userIds } = expandMentions(body, members);
      await onSubmit({
        body: expandedBody,
        rawBody: body,
        mentionUserIds: userIds,
        attachments,
        setAttachments,
      });
      setValue("");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  }

  useImperativeHandle(ref, () => ({ submit }));

  /** Single entry point for every way a file can reach the tray. */
  function addFiles(files: File[]) {
    if (!attachmentsEnabled || files.length === 0) return;
    setAttachments((current) => {
      const { staged, error: stageError } = stageFiles(current, files);
      onError?.(stageError);
      return staged;
    });
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((a) => a.id !== id));
    if (attachInputRef.current) attachInputRef.current.value = "";
  }

  function handleAttachChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (!attachmentsEnabled) return;
    const files = Array.from(e.clipboardData?.files ?? []);
    // No files on the clipboard: an ordinary text paste, leave it to the browser.
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files.map((f) => nameClipboardFile(f)));
  }

  /**
   * Dragged text or a link also fires these events; only a drag carrying files
   * should light up the drop target or be swallowed by preventDefault().
   */
  function isFileDrag(e: DragEvent): boolean {
    return attachmentsEnabled && Array.from(e.dataTransfer?.types ?? []).includes("Files");
  }

  function handleDragEnter(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(e: DragEvent) {
    if (!isFileDrag(e)) return;
    // Without this the browser navigates to the dropped file.
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(e: DragEvent) {
    if (!isFileDrag(e)) return;
    // Moving between child elements fires leave/enter pairs; count depth so the
    // highlight only clears when the pointer leaves the input itself.
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  function handleDrop(e: DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles(Array.from(e.dataTransfer?.files ?? []));
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
            await submit();
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
    await submit();
  };

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-1 z-10 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-ring bg-background/90 text-sm text-muted-foreground">
          <ImageUp className="h-5 w-5" />
          <span>Drop to attach — up to {MAX_ATTACHMENTS} files, 0.5 MB each</span>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {header}
      {ac && matches.length > 0 && (
        <div className={cn("absolute bottom-full z-30 mb-1", suggestionsClassName)}>
          {ac.mode === "slash" ? (
            <SlashCommandList
              commands={slashMatches}
              activeIdx={activeIdx}
              onSelect={selectSlash}
              onHover={setActiveIdx}
            />
          ) : (
            <ul
              role="listbox"
              aria-label="Mention suggestions"
              className="max-h-56 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
            >
              {mentionMatches.map((m, i) => (
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
        </div>
      )}
      {attachmentsEnabled && (
        <StagedAttachments
          attachments={attachments}
          uploadingId={uploadingId}
          progress={uploadProgress}
          onRemove={removeAttachment}
        />
      )}
      <div className={INPUT_WRAPPER_CLS}>
        {attachmentsEnabled && (
          <>
            <input
              ref={attachInputRef}
              type="file"
              multiple
              aria-label="Attach file"
              className="sr-only"
              onChange={handleAttachChange}
              tabIndex={-1}
            />
            <button
              type="button"
              aria-label="Attach file"
              onClick={() => attachInputRef.current?.click()}
              className="ml-1 shrink-0 self-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </>
        )}
        <textarea
          ref={textareaRef}
          data-slot="textarea"
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
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
          onPaste={handlePaste}
          rows={1}
          className={cn(TEXTAREA_CLS, !sendButton && "pr-1.5")}
        />
        {sendButton && (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={disabled || (!value.trim() && attachments.length === 0 && !allowEmpty)}
            aria-label="Send message"
            className="shrink-0 self-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
});
