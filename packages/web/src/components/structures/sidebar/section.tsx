import { type ReactNode, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function Section({ title, action, children, defaultExpanded = true }: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section role="region" aria-label={title} className="flex flex-col">
      <header className="flex items-center gap-1 px-2 py-1 text-xs uppercase text-muted-foreground">
        <button
          type="button"
          aria-label={`toggle ${title} section`}
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1"
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          <h3 className="font-semibold">{title}</h3>
        </button>
        <div className="ml-auto">{action}</div>
      </header>
      {expanded && <div>{children}</div>}
    </section>
  );
}
