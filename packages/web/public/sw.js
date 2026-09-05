// Zooid service worker. Deliberately imports no application code — no bundler
// integration, no build-graph coupling. Two events, nothing else.

const ROOM_PATH = /\/room\/([^/?#]+)/;

function roomOf(url) {
  const m = ROOM_PATH.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}

function titleFor(p) {
  return p.room_name || p.room_id;
}

function bodyFor(p) {
  // Agent events carry no prose. Rendering `${sender}: ${undefined}` is the
  // failure this branch exists to prevent.
  switch (p.type) {
    case "dev.zooid.approval_request":
      return `${p.sender_display_name || "An agent"} needs approval`;
    case "dev.zooid.turn.end":
      return `${p.sender_display_name || "An agent"} finished`;
    case "dev.zooid.error":
      return p.body || `${p.sender_display_name || "An agent"} hit an error`;
    default:
      return p.sender_display_name ? `${p.sender_display_name}: ${p.body || ""}` : p.body || "New message";
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = event.data.json();
      } catch {
        // userVisibleOnly is a contract: a push that renders nothing gets the
        // origin penalised, so always show *something*.
        await self.registration.showNotification("Zooid", { body: "New activity" });
        return;
      }

      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // Suppression (§5): a visible client already looking at this room.
      const looking = windows.some(
        (c) => c.visibilityState === "visible" && roomOf(c.url) === payload.room_id,
      );
      if (looking) return;

      // Sound (§12). A worker cannot play audio, so a live client plays the
      // real cue and the notification stays silent; with no client at all the
      // OS default sound is the ceiling.
      let cued = false;
      if (payload.sound && windows.length > 0) {
        for (const c of windows) c.postMessage({ type: "sound", roomId: payload.room_id });
        cued = true;
      }

      await self.registration.showNotification(titleFor(payload), {
        body: bodyFor(payload),
        tag: payload.event_id,
        data: { roomId: payload.room_id },
        silent: cued || !payload.sound,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const roomId = event.notification.data && event.notification.data.roomId;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.length > 0) {
        // No React Router closure survives out here — the page navigates itself.
        await windows[0].focus();
        windows[0].postMessage({ type: "navigate", roomId });
        return;
      }
      await self.clients.openWindow(`/room/${roomId}`);
    })(),
  );
});
