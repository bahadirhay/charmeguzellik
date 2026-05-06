/* Charme yönetim — Web Push (VAPID). public/ kökünde olmalı. */
self.addEventListener("push", (event) => {
  let data = { title: "Bildirim", body: "", url: "/admin/appointments" };
  try {
    if (event.data) {
      const t = event.data.text();
      if (t) data = { ...data, ...JSON.parse(t) };
    }
  } catch {
    /* varsayılan */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || "",
      data: { url: data.url || "/admin/appointments" },
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/admin/appointments";
  const path = target.startsWith("http") ? target : new URL(target, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of clientList) {
        if (c.url.startsWith(self.location.origin) && "navigate" in c) {
          await c.navigate(path);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(path);
    })(),
  );
});
