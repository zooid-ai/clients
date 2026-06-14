import type { SlashCommandMeta } from "@/lib/slash-commands";

interface SlashCommandListProps {
  commands: SlashCommandMeta[];
  activeIdx: number;
  onSelect: (cmd: SlashCommandMeta) => void;
  onHover: (idx: number) => void;
}

export function SlashCommandList({ commands, activeIdx, onSelect, onHover }: SlashCommandListProps) {
  return (
    <ul
      role="listbox"
      aria-label="Command suggestions"
      className="max-h-56 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
    >
      {commands.map((cmd, i) => (
        <li
          key={cmd.name}
          role="option"
          aria-selected={i === activeIdx}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd);
          }}
          onMouseEnter={() => onHover(i)}
          className={
            "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm " +
            (i === activeIdx ? "bg-accent text-accent-foreground" : "")
          }
        >
          <span className="font-mono font-semibold text-primary">/{cmd.name}</span>
          <span className="text-xs text-muted-foreground">{cmd.description}</span>
          {cmd.source === "agent" && (
            <span className="ml-auto rounded-sm bg-muted px-1 text-[10px] uppercase text-muted-foreground">
              agent
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
