import type { ReactNode } from "react";

export function MainSplit({ left, main }: { left: ReactNode; main: ReactNode }) {
  return (
    <div className="main-split">
      <aside className="main-split__left">{left}</aside>
      <section className="main-split__main">{main}</section>
    </div>
  );
}
