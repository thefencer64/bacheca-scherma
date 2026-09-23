/**
 * BannerInstalla.js
 * Guida all'installazione della PWA adattata per piattaforma.
 * Si mostra una sola volta (localStorage) e scompare se già installata.
 */

import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'pwa_install_dismissed';

export default function BannerInstalla() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [piattaforma, setPiattaforma]       = useState(null);
  // 'android' | 'ios-safari' | 'ios-altro' | null

  useEffect(() => {
    // Già installata come PWA → non mostrare mai
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) return;

    // Già dismessa → non mostrare
    if (localStorage.getItem(STORAGE_KEY)) return;

    const ua       = navigator.userAgent;
    const isIOS    = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edgios|opios/i.test(ua);

    if (isIOS) {
      setPiattaforma(isSafari ? 'ios-safari' : 'ios-altro');
    }

    // Android: intercetta beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPiattaforma('android');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismetti() {
    localStorage.setItem(STORAGE_KEY, '1');
    setPiattaforma(null);
  }

  async function installa() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    localStorage.setItem(STORAGE_KEY, '1');
    setPiattaforma(null);
  }

  if (!piattaforma) return null;

  return (
    <div style={{
      backgroundColor: '#00244F',
      borderRadius: 16,
      padding: '1rem',
      marginBottom: '1rem',
      position: 'relative',
    }}>

      <button
        onClick={dismetti}
        style={{
          position: 'absolute', top: 10, right: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)', padding: 4, lineHeight: 0,
        }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <p style={{ color: '#fff', fontWeight: 600, fontSize: 14, margin: '0 0 0.4rem', paddingRight: 24 }}>
        Installa l'app
      </p>

      {piattaforma === 'android' && (
        <>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: '0 0 0.75rem' }}>
            Aggiungila alla schermata home per accedere rapidamente agli avvisi.
          </p>
          <button
            onClick={installa}
            style={{
              backgroundColor: '#0179C0', color: '#fff',
              border: 'none', borderRadius: 10, padding: '0.5rem 1.25rem',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
            Installa
          </button>
        </>
      )}

      {piattaforma === 'ios-safari' && (
        <>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: '0 0 0.75rem' }}>
            Aggiungila alla schermata home per accedere rapidamente agli avvisi.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Passo numero="1">
              Tocca{' '}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: 6, padding: '1px 6px', verticalAlign: 'middle',
              }}>
                <span style={{ fontSize: 11, letterSpacing: 1 }}>•••</span>
              </span>
              {' '}in basso a destra, poi tocca{' '}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: 6, padding: '1px 6px', verticalAlign: 'middle',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span style={{ fontSize: 11 }}>Condividi</span>
              </span>
            </Passo>
            <Passo numero="2">
              Seleziona <strong style={{ color: '#fff' }}>"Aggiungi a schermata Home"</strong>
            </Passo>
          </div>
        </>
      )}

      {piattaforma === 'ios-altro' && (
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, margin: 0 }}>
          Per installare l'app, apri questa pagina in{' '}
          <strong style={{ color: '#fff' }}>Safari</strong>, tocca i{' '}
          <strong style={{ color: '#fff' }}>3 puntini (···)</strong> in basso a destra,
          poi <strong style={{ color: '#fff' }}>Condividi</strong> →{' '}
          <strong style={{ color: '#fff' }}>"Aggiungi a schermata Home"</strong>.
        </p>
      )}

    </div>
  );
}

function Passo({ numero, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{
        backgroundColor: 'rgba(255,255,255,0.2)',
        color: '#fff', fontSize: 11, fontWeight: 700,
        borderRadius: '50%', width: 20, height: 20, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {numero}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 1.5 }}>
        {children}
      </span>
    </div>
  );
}
