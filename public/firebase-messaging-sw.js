/* eslint-disable */
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

// These values are public client config — safe to embed in a static file.
firebase.initializeApp({
  apiKey: "AIzaSyAdM7RjA4JhYmAfytQWLXBeiZ7K4N9ctWA",
  authDomain: "thread-theory-home-20260405.firebaseapp.com",
  projectId: "thread-theory-home-20260405",
  messagingSenderId: "268029612759",
  appId: "1:268029612759:web:77168809335d28a64f5692"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  if (!payload.notification) return;
  const { title, body } = payload.notification;
  const link = payload.fcmOptions?.link || "/";
  self.registration.showNotification(title, {
    body,
    icon: "/icon.svg",
    data: { link }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(link));
      if (existing) return existing.focus();
      return self.clients.openWindow(link);
    })
  );
});
