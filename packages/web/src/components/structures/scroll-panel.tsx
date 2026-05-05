import { useEffect, useRef, type ReactNode } from "react";

// MVP: stick-to-bottom only. Backward pagination is a follow-up.
export function ScrollPanel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });
  return (
    <div ref={ref} className="scroll-panel">
      {children}
    </div>
  );
}
