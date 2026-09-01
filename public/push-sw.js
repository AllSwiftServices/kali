self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", function (event) {
  if (!(self.Notification && self.Notification.permission === "granted")) {
    return;
  }

  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch (e) {
    console.warn("Push event with non-JSON data:", event.data?.text());
    data = { body: event.data?.text() };
  }

  const title = data.title || "Avent Ridge Exchange Update";
  const options = {
    body: data.body || "You have a new notification.",
    icon: data.icon || "/icon.png",
    badge: data.badge || "/icon.png",
    data: {
      url: data.url || "/",
    },
    // Vibration pattern for better visibility
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        if (clientList.length > 0) {
          let client = clientList[0];
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) {
              client = clientList[i];
            }
          }
          return client.focus();
        }
        return clients.openWindow(event.notification.data.url || "/");
      }),
  );
});
