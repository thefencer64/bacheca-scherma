/**
 * usePushNotification.js
 * Hook per gestire le push notification FCM lato client.
 * Richiede il permesso, ottiene il token e lo salva su Firestore.
 */

import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from './useAuth';

// VAPID key da Firebase Console → Impostazioni progetto → Cloud Messaging
// → Certificati push web → Genera coppia di chiavi
const VAPID_KEY = 'BPc8I11jjSNPw6_bG6v66VnphTEdutQvDprm1mVLQeJCUOErENe0CO4N-3xvkTIFC7nRB-agsepZ9u2WNTMaT6U';

export function usePushNotification() {
  const { utente }                    = useAuth();
  const [permesso, setPermesso]       = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  const [token, setToken]             = useState(null);
  const [errore, setErrore]           = useState(null);

  useEffect(() => {
    if (!utente) return;
    if (permesso !== 'granted') return;

    let unsubscribe;
    inizializzaFCM().then(unsub => { unsubscribe = unsub; });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [utente, permesso]);

  async function richiediPermesso() {
    try {
      const risultato = await Notification.requestPermission();
      setPermesso(risultato);
      if (risultato === 'granted') {
        await inizializzaFCM();
      }
      return risultato;
    } catch (e) {
      setErrore(e.message);
      return 'denied';
    }
  }

  async function inizializzaFCM() {
    try {
      // Registra il service worker
      const registration = await navigator.serviceWorker.register('/service-worker.js');

      const messaging = getMessaging();
      const fcmToken  = await getToken(messaging, {
        vapidKey:            VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (fcmToken) {
        setToken(fcmToken);
        // Salva il token su Firestore tramite Cloud Function
        const functions  = getFunctions(undefined, 'europe-west1');
        const aggiorna   = httpsCallable(functions, 'aggiornaFcmToken');
        await aggiorna({ token: fcmToken });
      }

      // Gestisce i messaggi in foreground (data-only: payload.notification è assente)
      const unsubscribe = onMessage(messaging, (payload) => {
        const d     = payload.data || {};
        const title = payload.notification?.title || d.title || 'Bacheca Scherma';
        const body  = payload.notification?.body  || d.body  || '';
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/icons/icon-192.png' });
        }
      });

      return unsubscribe;

    } catch (e) {
      console.warn('FCM non disponibile:', e.message);
      setErrore(e.message);
    }
  }

  async function rimuoviToken() {
    if (!token) return;
    try {
      const functions = getFunctions(undefined, 'europe-west1');
      const rimuovi   = httpsCallable(functions, 'rimuoviFcmToken');
      await rimuovi({ token });
      setToken(null);
    } catch (e) {
      console.warn('Errore rimozione token:', e.message);
    }
  }

  return { permesso, token, errore, richiediPermesso, rimuoviToken };
}
