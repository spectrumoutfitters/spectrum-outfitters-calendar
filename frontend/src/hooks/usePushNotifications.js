import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          setIsLoading(false);
          return;
        }

        // Check if /sw.js exists before registering
        const swCheck = await fetch('/sw.js', { method: 'HEAD' }).catch(() => ({ ok: false }));
        if (!swCheck.ok) {
          setIsLoading(false);
          return;
        }

        setIsSupported(true);

        const reg = await navigator.serviceWorker.register('/sw.js');
        setRegistration(reg);

        const existingSub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!existingSub);
      } catch (err) {
        console.warn('Push notifications not available:', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const subscribe = useCallback(async () => {
    if (!registration || !isSupported) return false;
    try {
      setIsLoading(true);
      const { data } = await api.get('/push/vapid-public-key');
      const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      const subJson = sub.toJSON();
      await api.post('/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error('Push subscribe error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return false;
    try {
      setIsLoading(true);
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await api.delete('/push/unsubscribe', { data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration]);

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}
