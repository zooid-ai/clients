import { useEffect, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { RoomEvent, type IRoomTimelineData, type MatrixEvent, type Room } from "matrix-js-sdk";
import { MatrixClientPeg } from "@/client/peg";
import { sessionStorage_ } from "@/client/storage";
import { evaluateNotification } from "@/lib/matrix/notifications";

const ENABLED_KEY = "notifications-enabled";
// Stale flag from the old auto-prompt bug this cycle removes. sessionStorage_
// is actually localStorage (client/storage.ts), so it survives forever unless
// deleted — anyone who hit the bug carries it permanently otherwise.
const STALE_PROMPTED_KEY = "notifications-prompted";

export function notificationsEnabledLocally(): boolean {
  return sessionStorage_.get(ENABLED_KEY) !== "0";
}

export function setNotificationsEnabledLocally(enabled: boolean): void {
  sessionStorage_.set(ENABLED_KEY, enabled ? "1" : "0");
}

/**
 * The in-page fallback notifier. Active only when `hasPushSubscription` is
 * false — with a subscription registered, the service worker is the sole
 * renderer (ZNC025 §5); running both would double-notify on a live event.
 */
export function useNotifications(hasPushSubscription: boolean): void {
  const client = useSyncExternalStore(
    (cb) => MatrixClientPeg.subscribe(cb),
    () => MatrixClientPeg.safeGet(),
    () => null,
  );
  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage_.remove(STALE_PROMPTED_KEY);
  }, []);

  useEffect(() => {
    if (hasPushSubscription) return;
    if (!client || typeof Notification === "undefined") return;
    const onTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
      removed: boolean,
      data: IRoomTimelineData,
    ) => {
      if (!room || toStartOfTimeline || removed || !data.liveEvent) return;
      if (!client.isInitialSyncComplete()) return;
      if (Notification.permission !== "granted") return;
      if (!notificationsEnabledLocally()) return;
      if (document.hasFocus()) return;
      const payload = evaluateNotification(client, room, event);
      if (!payload) return;
      const notification = new Notification(payload.title, {
        body: payload.body,
        tag: payload.eventId,
      });
      notification.onclick = () => {
        window.focus();
        navigate(`/room/${payload.roomId}`);
        notification.close();
      };
    };
    client.on(RoomEvent.Timeline, onTimeline);
    return () => {
      client.off(RoomEvent.Timeline, onTimeline);
    };
  }, [client, navigate, hasPushSubscription]);
}
