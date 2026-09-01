import { useState, useEffect } from "react";
import { api } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    ) {
      // Try to register SW manually if it's not already
      const registerSW = async () => {
        try {
          let reg = await navigator.serviceWorker.getRegistration();
          if (!reg) {
            reg = await navigator.serviceWorker.register("/push-sw.js");
          }

          if (reg) {
            setRegistration(reg);
            const sub = await reg.pushManager.getSubscription();
             // Check if subscription has expired 
            if (sub) {
              // Ensure we check expiration using expirationTime
              if (sub.expirationTime && Date.now() > sub.expirationTime - 5 * 60 * 1000) {
                 // The subscription is valid
                 await sub.unsubscribe();
                 setSubscription(null);
                 setIsSubscribed(false);
              } else {
                 setSubscription(sub);
                 setIsSubscribed(true);
              }
            }
          }
        } catch (e) {
          console.error("SW registration failed", e);
        }
      };

      registerSW();
    }
  }, []);

  const subscribeToPush = async () => {
    if (!registration) {
      console.error("Service Worker not ready");
      return;
    }

    try {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        throw new Error("Public VAPID Key missing");
      }

      const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      setSubscription(sub);
      setIsSubscribed(true);

      // Send to backend
      const keys = sub.toJSON().keys;
      if (keys && keys.auth && keys.p256dh && sub.endpoint) {
        await api.post('/notifications/subscribe', {
            action: 'subscribe',
            endpoint: sub.endpoint,
            authKey: keys.auth,
            p256dhKey: keys.p256dh,
        });
        console.log("Push Subscription saved to backend");
      }
    } catch (error) {
      console.error("Failed to subscribe to push", error);
      throw error;
    }
  };

  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const unsubscribeFromPush = async () => {
    if (!subscription) return;

    try {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      setSubscription(null);
      setIsSubscribed(false);
      
      await api.post('/notifications/subscribe', {
        action: 'unsubscribe',
        endpoint
      });
      console.log("Unsubscribed from push");
    } catch (error) {
      console.error("Failed to unsubscribe", error);
    }
  };

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  return {
    isSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    requestPermission,
    permission,
    isSupported:
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window,
  };
}
