self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "POS";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || "pos-notify",
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || "/";
      for (const client of clientList) {
        // ทุกร้านใช้ service worker ตัวเดียวกัน อย่าพาไปโฟกัสหน้าของร้านอื่น
        if ("focus" in client && new URL(client.url).pathname.startsWith(url)) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    })
  );
});
