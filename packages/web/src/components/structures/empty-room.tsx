import { MessageSquare, PanelLeft } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

export function EmptyRoom() {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <div className="flex h-full items-center justify-center p-6 sm:p-10">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <MessageSquare className="h-7 w-7" aria-hidden />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Pick a room to get started
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isMobile
            ? "Open the room list to choose a conversation, or start a new one."
            : "Choose a room from the sidebar to view its conversation, or start a new one."}
        </p>
        {isMobile ? (
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted"
          >
            <PanelLeft className="h-4 w-4" aria-hidden />
            Open room list
          </button>
        ) : null}
      </div>
    </div>
  );
}
