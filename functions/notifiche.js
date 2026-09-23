/**
 * notifiche.js — Push notification FCM (firebase-functions v5)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated }  = require('firebase-functions/v2/firestore');
const admin                  = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const db     = admin.firestore();
const TS     = admin.firestore.FieldValue.serverTimestamp;
const REGION = 'europe-west1';

// ─────────────────────────────────────────────
// Stabilisce se un iscritto deve ricevere la push.
// - Avviso generale (categorieTarget vuoto) → tutti
// - Avviso categorizzato → chi ha categoriaCalcolata in categorieTarget
//                          + genitori con perFigli.categorieIds che interseca
// ─────────────────────────────────────────────
function isTargetato(iscr, categorieTarget) {
  // Avviso generale: array vuoto oppure contiene solo "generale"
  const isGenerale = !categorieTarget || categorieTarget.length === 0 ||
    categorieTarget.every(c => c === 'generale');
  if (isGenerale) return true;
  if (iscr.categoriaCalcolata && categorieTarget.includes(iscr.categoriaCalcolata)) return true;
  const catFigli = iscr.preferenzeNotifiche?.perFigli?.categorieIds || [];
  return catFigli.some(c => categorieTarget.includes(c));
}

// ─────────────────────────────────────────────
// Raccoglie token FCM degli iscritti attivi
// ─────────────────────────────────────────────
async function raccogliToken(societaId, categorieTarget, destinatariUid) {
  const tokenSet = new Set();

  if (destinatariUid && destinatariUid.length > 0) {
    // Messaggio personale: token solo dai destinatari nominativi
    await Promise.all(destinatariUid.map(async uid => {
      const utenteSnap = await db.collection('utenti').doc(uid).get();
      if (!utenteSnap.exists) return;
      (utenteSnap.data().fcmTokens || []).forEach(t => tokenSet.add(t));
    }));
  } else {
    // Avviso pubblico: filtra per categorie tra gli iscritti attivi
    const iscrizioniSnap = await db
      .collection('societa').doc(societaId)
      .collection('iscrizioni')
      .where('statoAccount', '==', 'attivo')
      .get();

    await Promise.all(iscrizioniSnap.docs.map(async doc => {
      const iscr = doc.data();
      if (!isTargetato(iscr, categorieTarget)) return;

      const utenteSnap = await db.collection('utenti').doc(doc.id).get();
      if (!utenteSnap.exists) return;
      (utenteSnap.data().fcmTokens || []).forEach(t => tokenSet.add(t));
    }));
  }

  return Array.from(tokenSet);
}

// ─────────────────────────────────────────────
// Invia FCM in batch (data-only), pulisce token scaduti
// ─────────────────────────────────────────────
async function inviaFCM(tokens, titolo, corpo, avvisoId, societaId) {
  if (tokens.length === 0) return { inviati: 0, falliti: 0 };

  const BATCH_SIZE = 500;
  let inviati = 0, falliti = 0;
  const tokenDaRimuovere = [];

  const url = societaId && avvisoId ? `/${societaId}/avviso/${avvisoId}` : '/scegli-societa';

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const chunk = tokens.slice(i, i + BATCH_SIZE);

    // Messaggio data-only: nessun campo notification nel webpush.
    // Il push event del service worker gestisce la visualizzazione su tutte le piattaforme.
    // Con webpush.notification FCM tenta di mostrare la notifica via SDK interno,
    // ma senza firebase-messaging-sw.js l'operazione fallisce silenziosamente su Android.
    const risultato = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      webpush: {
        headers: { Urgency: 'high' },
        data: {
          title:     titolo,
          body:      corpo,
          societaId: societaId || '',
          avvisoId:  avvisoId  || '',
          url,
        },
        fcmOptions: { link: url },
      },
    });

    risultato.responses.forEach((resp, idx) => {
      if (resp.success) {
        inviati++;
      } else {
        falliti++;
        const codice = resp.error?.code;
        if (
          codice === 'messaging/registration-token-not-registered' ||
          codice === 'messaging/invalid-registration-token'
        ) {
          tokenDaRimuovere.push(chunk[idx]);
        }
      }
    });
  }

  // Rimuove i token scaduti da Firestore
  if (tokenDaRimuovere.length > 0) {
    await Promise.all(
      tokenDaRimuovere.map(async token => {
        const snap = await db
          .collection('utenti')
          .where('fcmTokens', 'array-contains', token)
          .limit(1)
          .get();
        await Promise.all(snap.docs.map(doc =>
          doc.ref.update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
          })
        ));
      })
    );
  }

  return { inviati, falliti };
}

// ─────────────────────────────────────────────
// onAvvisoCreato — Firestore trigger
// ─────────────────────────────────────────────
exports.onAvvisoCreato = onDocumentCreated(
  { document: 'societa/{societaId}/avvisi/{avvisoId}', region: REGION },
  async (event) => {
    const { societaId, avvisoId } = event.params;
    const avviso = event.data.data();

    if (!avviso.visibile) return;

    const categorieTarget = avviso.categorieTarget || [];
    const destinatariUid  = avviso.destinatariUid  || [];
    const tokens          = await raccogliToken(societaId, categorieTarget, destinatariUid);
    const corpo           = avviso.corpo.length > 100
      ? avviso.corpo.substring(0, 97) + '…'
      : avviso.corpo;

    const { inviati, falliti } = await inviaFCM(
      tokens, avviso.titolo, corpo, avvisoId, societaId
    );

    await event.data.ref.update({ pushInviata: true });

    await db
      .collection('societa').doc(societaId)
      .collection('notifiche').add({
        avvisoId, titolo: avviso.titolo, categorieTarget,
        tokenTotali: tokens.length, inviati, falliti,
        inviataAt: TS(), inviataDa: avviso.autoreUid, manuale: false,
      });
  }
);

// ─────────────────────────────────────────────
// inviaNotifica — callable
// ─────────────────────────────────────────────
exports.inviaNotifica = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Accesso negato');

  const { societaId, titolo, corpo, categorieTarget, avvisoId } = request.data;
  if (!societaId || !titolo || !corpo) {
    throw new HttpsError('invalid-argument', 'societaId, titolo e corpo obbligatori');
  }

  const adminSnap = await db
    .collection('societa').doc(societaId)
    .collection('iscrizioni').doc(request.auth.uid)
    .get();
  if (!adminSnap.exists || !adminSnap.data().ruoli.includes('admin')) {
    throw new HttpsError('permission-denied', 'Non sei admin di questa società');
  }

  const tokens = await raccogliToken(societaId, categorieTarget || []);
  const { inviati, falliti } = await inviaFCM(
    tokens, titolo, corpo, avvisoId || '', societaId
  );

  await db
    .collection('societa').doc(societaId)
    .collection('notifiche').add({
      avvisoId: avvisoId || null, titolo,
      categorieTarget: categorieTarget || [],
      tokenTotali: tokens.length, inviati, falliti,
      inviataAt: TS(), inviataDa: request.auth.uid, manuale: true,
    });

  return { success: true, inviati, falliti };
});
