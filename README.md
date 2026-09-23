<p align="center">
  <img src="public/icons/icon-192.png" width="96" alt="Bacheca Scherma">
</p>

<h1 align="center">Bacheca Scherma</h1>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&labelColor=20232a">
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth%20%7C%20Functions-FFCA28?logo=firebase&logoColor=white&labelColor=333">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-Web%20Push%20%7C%20Offline-5A0FC8?logo=pwa&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
</p>

Progressive Web App per la gestione di comunicazioni e iscrizioni nelle società di scherma italiane. Mobile-first, multi-società (un sottodominio per club), in italiano.

## Stack tecnico

- **Frontend:** React 18, React Router v6, TanStack React Query, Tailwind CSS
- **Backend:** Firebase Firestore, Firebase Authentication, Cloud Functions (europe-west1)
- **Form:** react-hook-form
- **PWA:** Service Worker, Web Push (FCM)

## Struttura

```
functions/     Cloud Functions (admin.js, auth.js, categorie.js, notifiche.js, index.js)
public/        Asset statici, manifest PWA, icone
src/           Sorgente React (componenti, pagine, hook)
```

## Architettura mono-società

Ogni club ha un proprio sottodominio (`nomeclub.bachecascherma.it`); `getSocietaId()` lo estrae dall'hostname. Il dominio root mostra una landing page informativa.

## Sviluppo

```bash
npm install
npm start
```

Deploy Cloud Functions:

```bash
firebase deploy --only functions:nomeFunzione
```

## Repository collegati

- [bacheca-scherma-docs](https://github.com/thefencer64/bacheca-scherma-docs) — manuali utente/admin
- [bacheca-scherma-utils](https://github.com/thefencer64/bacheca-scherma-utils) — credenziali, backup e script di manutenzione (privato, accesso ristretto)
