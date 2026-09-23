import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Calcola l'altezza reale disponibile su tutti i dispositivi mobile
// Soluzione compatibile con tutti i browser incluso Safari iOS vecchi
function impostaAltezza() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
impostaAltezza();
window.addEventListener('resize', impostaAltezza);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registra il Service Worker solo in produzione
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(reg => {
        console.log('Service Worker registrato:', reg.scope);
      })
      .catch(err => {
        console.warn('Service Worker non registrato:', err);
      });
  });
}
