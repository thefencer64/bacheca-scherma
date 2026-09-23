/**
 * auth.js — Ciclo di vita utenti e iscrizioni (firebase-functions v5)
 */

const { onCall, HttpsError }         = require('firebase-functions/v2/https');
const { onDocumentCreated,
        onDocumentUpdated }          = require('firebase-functions/v2/firestore');

const admin                          = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const db     = admin.firestore();
const TS     = admin.firestore.FieldValue.serverTimestamp;
const REGION = 'europe-west1';

const {
  calcolaCategoria,
  buildPreferenzeProprie,
  buildPreferenzePerFigli,
} = require('./categorie');

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────

async function loadCategorie() {
  const snap = await db.collection('configCategorie').doc('corrente').get();
  if (!snap.exists) throw new Error('configCategorie/corrente mancante');
  return snap.data().categorie;
}

async function loadSocieta(societaId) {
  const snap = await db.collection('societa').doc(societaId).get();
  if (!snap.exists) throw new Error(`Società ${societaId} non trovata`);
  return snap.data();
}

function inviaEmail(to, templateName, templateData) {
  return db.collection('mail').add({
    to: Array.isArray(to) ? to : [to],
    template: { name: templateName, data: templateData },
  });
}

function creaNotificaAdmin(societaId, tipo, dati) {
  return db
    .collection('societa').doc(societaId)
    .collection('notificheAdmin').add({
      tipo, letta: false, creatoAt: TS(), ...dati,
    });
}

// ─────────────────────────────────────────────
// onUtenteCreato — Firestore trigger su utenti/{uid}
// Il client crea il documento utente dopo la registrazione Auth.
// Questa function lo completa con i campi mancanti se necessario.
// ─────────────────────────────────────────────
exports.onUtenteCreato = onDocumentCreated(
  { document: 'utenti/{uid}', region: REGION },
  async (event) => {
    const dati = event.data.data();
    const update = {};

    // Normalizza campi mancanti
    if (!dati.fcmTokens)   update.fcmTokens   = [];
    if (!dati.aggiornatoAt) update.aggiornatoAt = TS();

    if (Object.keys(update).length > 0) {
      await event.data.ref.update(update);
    }
  }
);

// ─────────────────────────────────────────────
// onIscrizioneCreata — Firestore trigger
// ─────────────────────────────────────────────
exports.onIscrizioneCreata = onDocumentCreated(
  { document: 'societa/{societaId}/iscrizioni/{uid}', region: REGION },
  async (event) => {
    const { societaId, uid } = event.params;
    const iscr  = event.data.data();
    const ruoli = iscr.ruoli || [];
    const update = {};

    if (ruoli.includes('atleta')) {
      const utenteSnap = await db.collection('utenti').doc(uid).get();
      const utente     = utenteSnap.data() || {};
      if (utente.dataNascita) {
        const categorie = await loadCategorie();
        update.categoriaCalcolata = calcolaCategoria(categorie, utente.dataNascita);
        update['preferenzeNotifiche.proprie'] = buildPreferenzeProprie(categorie, utente.dataNascita);
      }
    }

    if (Object.keys(update).length > 0) {
      await event.data.ref.update({ ...update, aggiornatoAt: TS() });
    }

    // I minorenni pre-registrati non notificano l'admin finché non si registrano
    if (iscr.statoAccount === 'pre_registrato') return;

    const societa        = await loadSocieta(societaId);
    const utenteSnap     = await db.collection('utenti').doc(uid).get();
    const utente         = utenteSnap.data() || {};
    const nomeCompleto   = `${utente.nome} ${utente.cognome}`.trim();
    const tipoRichiesta  = ruoli.includes('atleta') ? 'nuova_iscrizione' : 'nuova_iscrizione_genitore';

    await Promise.all([
      inviaEmail(societa.emailNotifiche || [], 'richiesta_iscrizione', {
        nomeSocieta:  societa.nome,
        nomeUtente:   nomeCompleto,
        emailUtente:  utente.email,
        ruoli:        ruoli.join(', '),
        societaId,
        uid,
      }),
      creaNotificaAdmin(societaId, tipoRichiesta, {
        uid, nomeUtente: nomeCompleto, ruoli,
      }),
    ]);
  }
);

// ─────────────────────────────────────────────
// onRelazioneCreta — Firestore trigger
// ─────────────────────────────────────────────
exports.onRelazioneCreta = onDocumentCreated(
  { document: 'societa/{societaId}/relazioni/{relId}', region: REGION },
  async (event) => {
    const { societaId } = event.params;
    const rel = event.data.data();
    const { figlioUid, genitoreUid } = rel;

    // Se il figlio è pre-registrato (non ha ancora un account Auth),
    // non notificare l'admin — ci penserà collegaUtentePreRegistrato
    // al momento in cui il figlio completa la registrazione.
    const iscrizioneSnap = await db
      .collection('societa').doc(societaId)
      .collection('iscrizioni').doc(figlioUid)
      .get();
    if (iscrizioneSnap.exists && iscrizioneSnap.data().statoAccount === 'pre_registrato') return;

    await db
      .collection('societa').doc(societaId)
      .collection('iscrizioni').doc(figlioUid)
      .update({ statoAccount: 'attesa_admin', aggiornatoAt: TS() });

    const [genitoreSnap, figlioSnap, societa] = await Promise.all([
      db.collection('utenti').doc(genitoreUid).get(),
      db.collection('utenti').doc(figlioUid).get(),
      loadSocieta(societaId),
    ]);

    const genitore = genitoreSnap.data() || {};
    const figlio   = figlioSnap.data()   || {};

    await Promise.all([
      inviaEmail(societa.emailNotifiche || [], 'richiesta_iscrizione_minore', {
        nomeSocieta:   societa.nome,
        nomeGenitore:  `${genitore.nome} ${genitore.cognome}`.trim(),
        emailGenitore: genitore.email,
        nomeFiglio:    `${figlio.nome} ${figlio.cognome}`.trim(),
        societaId,
        figlioUid,
      }),
      creaNotificaAdmin(societaId, 'nuova_iscrizione_minore', {
        figlioUid,
        nomeFiglio:   `${figlio.nome} ${figlio.cognome}`.trim(),
        genitoreUid,
        nomeGenitore: `${genitore.nome} ${genitore.cognome}`.trim(),
      }),
    ]);
  }
);

// ─────────────────────────────────────────────
// onIscrizioneAggiornata — Firestore trigger
// ─────────────────────────────────────────────
exports.onIscrizioneAggiornata = onDocumentUpdated(
  { document: 'societa/{societaId}/iscrizioni/{uid}', region: REGION },
  async (event) => {
    const { societaId, uid } = event.params;
    const prima = event.data.before.data();
    const dopo  = event.data.after.data();

    const utenteSnap = await db.collection('utenti').doc(uid).get();
    const utente     = utenteSnap.data() || {};
    const update     = {};

    if (dopo.ruoli.includes('atleta') && utente.dataNascita) {
      const categorie = await loadCategorie();
      const cat       = calcolaCategoria(categorie, utente.dataNascita);
      if (cat !== prima.categoriaCalcolata) {
        update.categoriaCalcolata = cat;
        update['preferenzeNotifiche.proprie'] = buildPreferenzeProprie(categorie, utente.dataNascita);
      }
    }

    if (Object.keys(update).length > 0) {
      await event.data.after.ref.update({ ...update, aggiornatoAt: TS() });
    }

    const prefCambiate =
      JSON.stringify(prima.preferenzeNotifiche?.proprie) !==
      JSON.stringify(dopo.preferenzeNotifiche?.proprie);

    if (prefCambiate) {
      const relazioniSnap = await db
        .collection('societa').doc(societaId)
        .collection('relazioni')
        .where('figlioUid', '==', uid)
        .get();

      for (const relDoc of relazioniSnap.docs) {
        const genitoreUid   = relDoc.data().genitoreUid;
        const altreRelSnap  = await db
          .collection('societa').doc(societaId)
          .collection('relazioni')
          .where('genitoreUid', '==', genitoreUid)
          .get();

        const categorieIdsFigli = await Promise.all(
          altreRelSnap.docs.map(async d => {
            const fSnap = await db
              .collection('societa').doc(societaId)
              .collection('iscrizioni').doc(d.data().figlioUid)
              .get();
            return fSnap.exists
              ? (fSnap.data().preferenzeNotifiche?.proprie?.categorieIds || [])
              : [];
          })
        );

        await db
          .collection('societa').doc(societaId)
          .collection('iscrizioni').doc(genitoreUid)
          .update({
            'preferenzeNotifiche.perFigli': buildPreferenzePerFigli(categorieIdsFigli),
            aggiornatoAt: TS(),
          });
      }
    }
  }
);

// ─────────────────────────────────────────────
// aggiornaFcmToken — callable
// ─────────────────────────────────────────────
exports.aggiornaFcmToken = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Accesso negato');
  const { token } = request.data;
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'Token non valido');
  }
  await db.collection('utenti').doc(request.auth.uid).update({
    fcmTokens:    admin.firestore.FieldValue.arrayUnion(token),
    aggiornatoAt: TS(),
  });
  return { success: true };
});

// ─────────────────────────────────────────────
// rimuoviFcmToken — callable
// ─────────────────────────────────────────────
exports.rimuoviFcmToken = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Accesso negato');
  const { token } = request.data;
  if (!token) throw new HttpsError('invalid-argument', 'Token non valido');
  await db.collection('utenti').doc(request.auth.uid).update({
    fcmTokens:    admin.firestore.FieldValue.arrayRemove(token),
    aggiornatoAt: TS(),
  });
  return { success: true };
});
