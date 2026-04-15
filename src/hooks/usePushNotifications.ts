import { useEffect, useState, useCallback } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import axios from 'axios';

export const usePushNotifications = (isAuthenticated: boolean) => {
  const [permission, setPermission] = useState<NotificationPermission | 'prompt'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'prompt'
  );
  const [loading, setLoading] = useState(false);

  const registerPush = useCallback(async () => {
    try {
      setLoading(true);
      if (Capacitor.isNativePlatform()) {
        // Native Capacitor Push
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
          
          PushNotifications.addListener('registration', async ({ value: token }) => {
            console.log('Push registration success, native token:', token);
            // In a real app, we would send this token to an FCM-capable backend.
            // For now, we focus on the Web Push implementation.
          });
        }
      } else if ('serviceWorker' in navigator && 'PushManager' in window) {
        // Web Push via Service Worker
        const registration = await navigator.serviceWorker.ready;
        
        // Get VAPID public key
        const { data: config } = await axios.get('/api/push/config');
        if (!config.publicKey) {
          console.warn('Push registration failed: VAPID public key not found');
          return;
        }

        // Request permission explicitly if not already granted
        if (Notification.permission === 'default') {
          const result = await Notification.requestPermission();
          setPermission(result);
          if (result !== 'granted') return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        });

        await axios.post('/api/push/register', {
          subscription,
          deviceType: 'web',
        });
        
        setPermission(Notification.permission);
        console.log('Web Push registration successful');
      }
    } catch (err) {
      console.error('Failed to register for push notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Auto-register only if granted already or if we haven't asked yet (prompt)
    // and the user is authenticated + interacted.
    // If denied, we don't bother until they manually click something.
    if (isAuthenticated && permission !== 'denied') {
      registerPush();
    }
  }, [isAuthenticated, permission, registerPush]);

  return { permission, loading, registerPush };
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
