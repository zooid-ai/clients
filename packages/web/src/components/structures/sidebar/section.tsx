import { type ReactNode, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** When set, expand/collapse state persists to localStorage under this key. */
  storageKey?: string;
}

function readPersisted(storageKey: string | undefined, fallback: boolean): boolean {
  if (!storageKey) return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === "expanded") return true;
    if (raw === "collapsed") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function Section({ title, action, children, defaultExpanded = true, storageKey }: SectionProps) {
  const [expanded, setExpanded] = useState(() => readPersisted(storageKey, defaultExpanded));

  const toggle = () => {
    setExpanded((e) => {
      const next = !e;
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, next ? "expanded" : "collapsed");
        } catch {
          // A private window throws on access — a section that fails to
          // remember must still render.
        }
      }
      return next;
    });
  };

  return (
    <section role="region" aria-label={title} className="flex flex-col">
      <header className="flex items-center gap-1 px-2 py-1 text-xs uppercase text-muted-foreground">
        <button
          type="button"
          aria-label={`toggle ${title} section`}
          onClick={toggle}
          className="flex items-center gap-1"
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          <h3 className="font-semibold">{title}</h3>
        </button>
        <div className="ml-auto">{action}</div>
      </header>
      {expanded && <div className="p-1">{children}</div>}
    </section>
  );
}
