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
    data: { url: "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data?.url || "/");
      return undefined;
    })
  );
});
