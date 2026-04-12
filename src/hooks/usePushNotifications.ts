import { useEffect, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import axios from 'axios';

export const usePushNotifications = (isAuthenticated: boolean) => {
  const [permission, setPermission] = useState<NotificationPermission | 'prompt'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'prompt'
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    const registerPush = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          // Native Capacitor Push
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }

          if (permStatus.receive === 'granted') {
            await PushNotifications.register();
            
            // On registration, we get a token
            PushNotifications.addListener('registration', async ({ value: token }) => {
              // Register this token with our backend
              // For Capacitor, we might need a different backend handler if we use FCM directly,
              // but if we are using Web Push for both (via Capacitor Browser or similar), we handle accordingly.
              // However, usually Capacitor Native Push uses FCM tokens.
              // For simplicity in this unified implementation, we will focus on Web Push for now,
              // and mark where native push would handle its token.
              console.log('Push registration success, token:', token);
            });
          }
        } else if ('serviceWorker' in navigator && 'PushManager' in window) {
          // Web Push via Service Worker
          const registration = await navigator.serviceWorker.ready;
          
          // Get VAPID public key
          const { data: config } = await axios.get('/api/push/config');
          if (!config.publicKey) return;

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey),
          });

          await axios.post('/api/push/register', {
            subscription,
            deviceType: 'web',
          });
          
          setPermission(Notification.permission);
        }
      } catch (err) {
        console.error('Failed to register for push notifications:', err);
      }
    };

    registerPush();
  }, [isAuthenticated]);

  return { permission };
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
