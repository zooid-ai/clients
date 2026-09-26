import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { Room } from "matrix-js-sdk";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

const MAX_RESULTS = 8;

export interface RoomPickerProps {
  rooms: Room[];
  value: string | null;
  onChange: (roomId: string | null) => void;
}

/**
 * A "To:" field for one room: search, pick from the dropdown, and the room
 * shows as a chip until × clears it. Keyboard handling comes from cmdk, and the
 * popover owns Escape so it doesn't reach the dialog around it.
 */
export function RoomPicker({ rooms, value, onChange }: RoomPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const picked = rooms.find((r) => r.roomId === value) ?? null;
  const q = query.trim().toLowerCase();
  const matches = q ? rooms.filter((r) => r.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS) : [];

  function pick(roomId: string) {
    onChange(roomId);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <Popover open={open && !picked && q !== ""} onOpenChange={setOpen}>
      <Command shouldFilter={false} className="overflow-visible bg-transparent">
        <PopoverAnchor asChild>
          <div
            ref={anchorRef}
            className="flex min-h-9 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
          >
            <span className="shrink-0 text-muted-foreground">To:</span>
            {picked ? (
              <span className="flex min-w-0 items-center gap-1 rounded-md bg-accent py-0.5 pl-2 pr-1 text-accent-foreground">
                <span className="truncate">{picked.name}</span>
                <button
                  type="button"
                  aria-label={`Clear ${picked.name}`}
                  onClick={clear}
                  className="shrink-0 rounded-sm p-0.5 hover:bg-background/60"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <input
                ref={inputRef}
                role="combobox"
                aria-label="Search rooms and DMs"
                aria-expanded={open && q !== ""}
                placeholder="Search rooms and DMs"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                className="h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-1"
          // Focus stays in the input while the list is open.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <CommandList>
            {matches.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No rooms match</p>}
            {matches.map((r) => (
              <CommandItem key={r.roomId} value={r.roomId} onSelect={() => pick(r.roomId)}>
                <span className="truncate">{r.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  );
}
