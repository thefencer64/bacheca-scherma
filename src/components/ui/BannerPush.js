/**
 * BannerPush.js
 * Banner che appare nella bacheca per chiedere il permesso
 * alle push notification. Si mostra solo se non è già stato dato.
 */

import React, { useState } from 'react';
import { usePushNotification } from '../../hooks/usePushNotification';

export default function BannerPush() {
  const { permesso, richiediPermesso } = usePushNotification();
  const [nascosto, setNascosto]        = useState(false);
  const [caricamento, setCaricamento]  = useState(false);

  // Non mostrare se: permesso già dato/negato, o banner chiuso
  if (permesso !== 'default' || nascosto) return null;

  // Non mostrare se le notifiche non sono supportate
  if (typeof Notification === 'undefined') return null;

  // Le push funzionano solo se installata come PWA:
  // - iOS: obbligatorio (Apple non supporta push nel browser)
  // - Android: necessario per affidabilità (il SO termina i SW dei tab browser)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches
             || window.navigator.standalone === true;
  if (!isPWA) return null;

  async function onAttivaClick() {
    setCaricamento(true);
    await richiediPermesso();
    setCaricamento(false);
  }

  return (
    <div className="bg-scherma-blue rounded-2xl p-4 mb-4 flex items-start gap-3">
      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center
                      justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"
             stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002
                   6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388
                   6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3
                   0 11-6 0v-1m6 0H9" />
        </svg>
      </div>

      <div className="flex-1">
        <p className="text-white font-medium text-sm">
          Attiva le notifiche
        </p>
        <p className="text-white/70 text-xs mt-0.5">
          Ricevi gli avvisi in tempo reale anche quando l'app è chiusa
        </p>

        <div className="flex gap-2 mt-3">
          <button
            onClick={onAttivaClick}
            disabled={caricamento}
            className="bg-white text-scherma-blue text-xs font-semibold
                       px-4 py-2 rounded-xl disabled:opacity-70">
            {caricamento ? 'Attivazione...' : 'Attiva'}
          </button>
          <button
            onClick={() => setNascosto(true)}
            className="text-white/60 text-xs px-3 py-2">
            Non ora
          </button>
        </div>
      </div>
    </div>
  );
}
