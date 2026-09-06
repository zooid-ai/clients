import { useEffect } from "react";

/**
 * Dismisses the service worker's notifications for the room you are looking at.
 *
 * The SW's §5 suppression only decides whether to *create* a notification, and
 * it is evaluated once, when the push arrives. Nothing retracted a notification
 * afterwards — so one raised while you were away stayed in the registration
 * indefinitely. That was invisible for as long as notifications auto-expired as
 * banners; giving the agent events `requireInteraction` (they exist for when
 * you are away, so they must not expire unseen) made the leftovers persist on
 * screen and follow you back to the tab.
 *
 * Arriving at the room *is* reading it, so the notification has done its job.
 */
export function useClearRoomNotifications(roomId: string | null | undefined): void {
  useEffect(() => {
    if (!roomId) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    const clear = async () => {
      // Visible, not focused: a room on a second monitor is still being read,
      // and it is what the SW's own suppression check keys off.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg || cancelled || !reg.getNotifications) return;
      for (const n of await reg.getNotifications()) {
        if (n.data?.roomId === roomId) n.close();
      }
    };

    void clear();
    // Coming back to an already-open room is the common case — the push landed
    // while the tab was hidden, so the mount-time pass above never runs for it.
    document.addEventListener("visibilitychange", clear);
    window.addEventListener("focus", clear);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", clear);
      window.removeEventListener("focus", clear);
    };
  }, [roomId]);
}
