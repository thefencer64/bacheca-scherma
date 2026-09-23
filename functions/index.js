/**
 * index.js — entry point Cloud Functions
 *
 * Struttura functions/:
 *   index.js       questo file
 *   auth.js        ciclo di vita utenti e iscrizioni
 *   admin.js       operazioni admin (approvazioni, rinnovo)
 *   notifiche.js   push FCM
 *   categorie.js   logica categorie FIS (condivisa con client)
 *
 * Deploy: firebase deploy --only functions
 */

const authFn  = require('./auth');
const adminFn = require('./admin');
const notifFn = require('./notifiche');

// Auth / lifecycle
exports.onUtenteCreato        = authFn.onUtenteCreato;
exports.onIscrizioneCreata    = authFn.onIscrizioneCreata;
exports.onRelazioneCreta      = authFn.onRelazioneCreta;
exports.onIscrizioneAggiornata = authFn.onIscrizioneAggiornata;
exports.aggiornaFcmToken      = authFn.aggiornaFcmToken;
exports.rimuoviFcmToken       = authFn.rimuoviFcmToken;

// Admin
exports.approvaIscrizione     = adminFn.approvaIscrizione;
exports.getIscritti           = adminFn.getIscritti;
exports.eliminaIscritto             = adminFn.eliminaIscritto;
exports.collegaUtentePreRegistrato  = adminFn.collegaUtentePreRegistrato;
exports.cercaPreRegistrato          = adminFn.cercaPreRegistrato;
exports.rifiutaIscrizione     = adminFn.rifiutaIscrizione;
exports.sospendiIscrizione    = adminFn.sospendiIscrizione;
exports.riattivaIscrizione    = adminFn.riattivaIscrizione;
exports.apriRinnovo               = adminFn.apriRinnovo;
exports.confermaRinnovi           = adminFn.confermaRinnovi;
exports.chiudiRinnovo             = adminFn.chiudiRinnovo;
exports.inviaMessaggioIscritti    = adminFn.inviaMessaggioIscritti;

// Notifiche
exports.onAvvisoCreato        = notifFn.onAvvisoCreato;
exports.inviaNotifica         = notifFn.inviaNotifica;
exports.modificaIscritto            = adminFn.modificaIscritto;
