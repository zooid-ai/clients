import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Clamps its children to 6 lines with a "See more" toggle, but
 * only when the content actually overflows that height — short messages
 * render unchanged, with no button. Used for thread root previews, where an
 * agent's long first message would otherwise dominate the sidebar.
 */
export function TruncatedBody({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [children]);

  return (
    <div>
      <div ref={ref} className={expanded ? undefined : "line-clamp-6"}>
        {children}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-xs text-primary hover:underline"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
