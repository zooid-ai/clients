import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { playTurnEndCue } from "@/lib/notification-sound";

/** Routes messages the service worker posts back to the page: play the turn-end cue, or navigate to a room. */
export function useServiceWorkerMessages(): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent<{ type: string; roomId?: string }>) => {
      if (event.data?.type === "sound") {
        playTurnEndCue();
      } else if (event.data?.type === "navigate" && event.data.roomId) {
        navigate(`/room/${event.data.roomId}`);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);
}
