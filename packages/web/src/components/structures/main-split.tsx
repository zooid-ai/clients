import type { ReactNode } from "react";

export function MainSplit({ left, main }: { left: ReactNode; main: ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r border-border bg-sidebar text-sidebar-foreground">
        {left}
      </aside>
      <section className="flex-1 min-w-0">{main}</section>
    </div>
  );
}
