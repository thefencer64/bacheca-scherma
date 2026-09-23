/**
 * admin.js — Operazioni admin (firebase-functions v5)
 */

const { onCall, HttpsError }  = require('firebase-functions/v2/https');
const { onDocumentCreated }   = require('firebase-functions/v2/firestore');
const admin                   = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const db     = admin.firestore();
const TS     = admin.firestore.FieldValue.serverTimestamp;
const REGION = 'europe-west1';

const { calcolaCategoria, buildPreferenzeProprie, buildPreferenzePerFigli, buildCategoriePerStagione } = require('./categorie');

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────

async function verificaAdmin(request, societaId) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Accesso negato');
  const snap = await db
    .collection('societa').doc(societaId)
    .collection('iscrizioni').doc(request.auth.uid)
    .get();
  if (!snap.exists
      || !snap.data().ruoli.includes('admin')
      || snap.data().statoAccount !== 'attivo') {
    throw new HttpsError('permission-denied', 'Non sei admin di questa società');
  }
}

async function loadCategorie() {
  const snap = await db.collection('configCategorie').doc('corrente').get();
  return snap.data().categorie;
}

function inviaEmail(to, templateName, dati) {
  return db.collection('mail').add({
    to: Array.isArray(to) ? to : [to],
    template: { name: templateName, data: dati },
  });
}

function creaNotificaAdmin(societaId, tipo, dati) {
  return db
    .collection('societa').doc(societaId)
    .collection('notificheAdmin').add({
      tipo, letta: false, creatoAt: TS(), ...dati,
    });
}

async function datiUtente(uid) {
  const snap = await db.collection('utenti').doc(uid).get();
  return snap.exists ? snap.data() : {};
}

async function nomeSocieta(societaId) {
  const snap = await db.collection('societa').doc(societaId).get();
  return snap.exists ? snap.data().nome : societaId;
}

// Dato la categoria calcolata, restituisce le categorie a cui l'atleta può partecipare
function categorieAccessibili(categoria) {
  const mappa = {
    'minions':     ['minions', 'bambini', 'giovanissimi', 'ragazzi', 'allievi', 'cadetti', 'giovani', 'assoluti'],
    'bambini':     ['bambini', 'giovanissimi', 'ragazzi', 'allievi', 'cadetti', 'giovani', 'assoluti'],
    'giovanissimi':['giovanissimi', 'ragazzi', 'allievi', 'cadetti', 'giovani', 'assoluti'],
    'ragazzi':     ['ragazzi', 'allievi', 'cadetti', 'giovani', 'assoluti'],
    'allievi':     ['allievi', 'cadetti', 'giovani', 'assoluti'],
    'cadetti':     ['cadetti', 'giovani', 'assoluti'],
    'giovani':     ['giovani', 'assoluti'],
    'assoluti':    ['assoluti'],
    'master_0':    ['assoluti', 'master_0'],
    'master_1':    ['assoluti', 'master_1'],
    'master_2':    ['assoluti', 'master_2'],
    'master_3':    ['assoluti', 'master_3'],
    'master_4':    ['assoluti', 'master_4'],
  };
  return mappa[categoria] || ['generale'];
}

// ─────────────────────────────────────────────
// approvaIscrizione
// ─────────────────────────────────────────────
exports.approvaIscrizione = onCall({ region: REGION }, async (request) => {
  const { societaId, uid } = request.data;
  await verificaAdmin(request, societaId);

  const iscrizioneRef  = db.collection('societa').doc(societaId).collection('iscrizioni').doc(uid);
  const iscrizioneSnap = await iscrizioneRef.get();
  if (!iscrizioneSnap.exists) throw new HttpsError('not-found', 'Iscrizione non trovata');

  const iscr = iscrizioneSnap.data();
  if (!['in_attesa', 'attesa_admin'].includes(iscr.statoAccount)) {
    throw new HttpsError('failed-precondition', `Stato '${iscr.statoAccount}' non approvabile`);
  }

  const utente = await datiUtente(uid);
  const update = {
    statoAccount: 'attivo',
    approvataDA:  request.auth.uid,
    approvataAt:  TS(),
    aggiornatoAt: TS(),
  };

  if (iscr.ruoli.includes('atleta') && utente.dataNascita) {
    const categorie = await loadCategorie();
    const cat = calcolaCategoria(categorie, utente.dataNascita);
    update.categoriaCalcolata = cat;
    // Pre-seleziona le categorie accessibili (propria + superiori)
    const cats = categorieAccessibili(cat);
    update['preferenzeNotifiche.proprie'] = {
      tutteLeCategorie: false,
      categorieIds: cats,
      generale: true,
    };
  }

  const batch = db.batch();
  batch.update(iscrizioneRef, update);

  if (iscr.statoAccount === 'attesa_admin') {
    const relSnap = await db
      .collection('societa').doc(societaId)
      .collection('relazioni')
      .where('figlioUid', '==', uid)
      .limit(1)
      .get();
    if (!relSnap.empty) {
      batch.update(relSnap.docs[0].ref, {
        approvataAt: TS(), approvataDA: request.auth.uid,
      });
    }
  }

  await batch.commit();

  const nome = await nomeSocieta(societaId);
  await inviaEmail(utente.email, 'iscrizione_approvata', {
    nomeUtente: `${utente.nome} ${utente.cognome}`.trim(),
    nomeSocieta: nome,
  });

  return { success: true };
});

// ─────────────────────────────────────────────
// rifiutaIscrizione
// ─────────────────────────────────────────────
exports.rifiutaIscrizione = onCall({ region: REGION }, async (request) => {
  const { societaId, uid, motivo } = request.data;
  await verificaAdmin(request, societaId);

  const ref  = db.collection('societa').doc(societaId).collection('iscrizioni').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Iscrizione non trovata');

  const utente = await datiUtente(uid);
  const nome   = await nomeSocieta(societaId);

  await inviaEmail(utente.email, 'iscrizione_rifiutata', {
    nomeUtente:  `${utente.nome} ${utente.cognome}`.trim(),
    nomeSocieta: nome,
    motivo:      motivo || 'nessun motivo specificato',
  });

  await ref.delete();
  return { success: true };
});

// ─────────────────────────────────────────────
// sospendiIscrizione
// ─────────────────────────────────────────────
exports.sospendiIscrizione = onCall({ region: REGION }, async (request) => {
  const { societaId, uid, motivo } = request.data;
  await verificaAdmin(request, societaId);

  const ref  = db.collection('societa').doc(societaId).collection('iscrizioni').doc(uid);
  const snap = await ref.get();
  if (!snap.exists || snap.data().statoAccount !== 'attivo') {
    throw new HttpsError('failed-precondition', 'Solo gli attivi possono essere sospesi');
  }

  await ref.update({
    statoAccount:      'sospeso',
    sospesoDa:         request.auth.uid,
    sostesoAt:         TS(),
    motivoSospensione: motivo || '',
    aggiornatoAt:      TS(),
  });
  return { success: true };
});

// ─────────────────────────────────────────────
// riattivaIscrizione
// ─────────────────────────────────────────────
exports.riattivaIscrizione = onCall({ region: REGION }, async (request) => {
  const { societaId, uid } = request.data;
  await verificaAdmin(request, societaId);

  const ref  = db.collection('societa').doc(societaId).collection('iscrizioni').doc(uid);
  const snap = await ref.get();
  if (!snap.exists || snap.data().statoAccount !== 'sospeso') {
    throw new HttpsError('failed-precondition', 'Solo i sospesi possono essere riattivati');
  }

  await ref.update({
    statoAccount:      'attivo',
    riattivataDA:      request.auth.uid,
    riattivataAt:      TS(),
    motivoSospensione: admin.firestore.FieldValue.delete(),
    aggiornatoAt:      TS(),
  });
  return { success: true };
});

// ─────────────────────────────────────────────
// apriRinnovo
// ─────────────────────────────────────────────
exports.apriRinnovo = onCall({ region: REGION }, async (request) => {
  const { societaId, nuovoAnno, categorie: categorieInput } = request.data;
  await verificaAdmin(request, societaId);

  if (!nuovoAnno) {
    throw new HttpsError('invalid-argument', 'nuovoAnno obbligatorio');
  }

  const nuoveCategorie = (categorieInput && categorieInput.length > 0)
    ? categorieInput
    : buildCategoriePerStagione(nuovoAnno);
  if (!nuoveCategorie) {
    throw new HttpsError('invalid-argument', 'Formato stagione non valido (YYYY-YYYY)');
  }

  await db.collection('configCategorie').doc('corrente').set({
    stagione:     nuovoAnno,
    categorie:    nuoveCategorie,
    aggiornatoAt: TS(),
  });

  await db.collection('societa').doc(societaId).update({
    rinnovoAperto: true,
    aggiornatoAt:  TS(),
  });

  const attivi = await db
    .collection('societa').doc(societaId)
    .collection('iscrizioni')
    .where('statoAccount', '==', 'attivo')
    .get();

  const batch = db.batch();
  attivi.docs.forEach(doc => {
    if (doc.data().ruoli?.includes('admin')) return;
    batch.update(doc.ref, { statoAccount: 'da_rinnovare', aggiornatoAt: TS() });
  });
  await batch.commit();

  await creaNotificaAdmin(societaId, 'rinnovo_aperto', {
    nuovoAnno, totale: attivi.size,
  });

  return { success: true, totale: attivi.size };
});

// ─────────────────────────────────────────────
// confermaRinnovi
// ─────────────────────────────────────────────
exports.confermaRinnovi = onCall({ region: REGION }, async (request) => {
  const { societaId, uids, nuovoAnno } = request.data;
  await verificaAdmin(request, societaId);

  if (!uids || !Array.isArray(uids) || uids.length === 0) {
    throw new HttpsError('invalid-argument', 'Lista uid vuota');
  }

  const categorie  = await loadCategorie();
  const CHUNK      = 400;
  let rinnovati    = 0;

  for (let i = 0; i < uids.length; i += CHUNK) {
    const chunk = uids.slice(i, i + CHUNK);
    const batch = db.batch();

    await Promise.all(chunk.map(async uid => {
      try {
        const ref  = db.collection('societa').doc(societaId).collection('iscrizioni').doc(uid);
        const snap = await ref.get();
        if (!snap.exists) return;

        const iscr   = snap.data();
        const update = {
          statoAccount:   'attivo',
          annoIscrizione: nuovoAnno,
          rinnovatoDA:    request.auth.uid,
          rinnovatoAt:    TS(),
          aggiornatoAt:   TS(),
        };

        if (iscr.ruoli.includes('atleta')) {
          const utente = await datiUtente(uid);
          if (utente.dataNascita) {
            update.categoriaCalcolata = calcolaCategoria(categorie, utente.dataNascita);
            update['preferenzeNotifiche.proprie'] = buildPreferenzeProprie(categorie, utente.dataNascita);
          }
        }

        batch.update(ref, update);
        rinnovati++;
      } catch (e) {
        console.error(`confermaRinnovi: errore su uid ${uid}:`, e);
      }
    }));

    await batch.commit();
  }

  // Ricalcola perFigli per i genitori coinvolti nel rinnovo
  const relazioniSnap = await db
    .collection('societa').doc(societaId)
    .collection('relazioni').get();

  const genitoriUid = [...new Set(relazioniSnap.docs.map(d => d.data().genitoreUid))];

  for (let i = 0; i < genitoriUid.length; i += CHUNK) {
    const chunk = genitoriUid.slice(i, i + CHUNK);
    const batch = db.batch();

    await Promise.all(chunk.map(async genitoreUid => {
      const relFigli = relazioniSnap.docs.filter(d => d.data().genitoreUid === genitoreUid);
      const categorieIdsFigli = await Promise.all(
        relFigli.map(async d => {
          const fSnap = await db
            .collection('societa').doc(societaId)
            .collection('iscrizioni').doc(d.data().figlioUid)
            .get();
          return fSnap.exists
            ? (fSnap.data().preferenzeNotifiche?.proprie?.categorieIds || [])
            : [];
        })
      );
      const ref = db.collection('societa').doc(societaId).collection('iscrizioni').doc(genitoreUid);
      batch.update(ref, {
        'preferenzeNotifiche.perFigli': buildPreferenzePerFigli(categorieIdsFigli),
        aggiornatoAt: TS(),
      });
    }));

    await batch.commit();
  }

  return { success: true, rinnovati };
});

// ─────────────────────────────────────────────
// chiudiRinnovo
// ─────────────────────────────────────────────
exports.chiudiRinnovo = onCall({ region: REGION }, async (request) => {
  const { societaId, nuovoAnno } = request.data;
  await verificaAdmin(request, societaId);

  const daRinnovare = await db
    .collection('societa').doc(societaId)
    .collection('iscrizioni')
    .where('statoAccount', '==', 'da_rinnovare')
    .get();

  const batch = db.batch();
  daRinnovare.docs.forEach(doc => {
    batch.update(doc.ref, { statoAccount: 'decaduto', aggiornatoAt: TS() });
  });
  batch.update(db.collection('societa').doc(societaId), {
    rinnovoAperto: false, annoSchermistico: nuovoAnno, aggiornatoAt: TS(),
  });
  await batch.commit();

  const emailPromises = daRinnovare.docs.map(async doc => {
    const utente = await datiUtente(doc.id);
    const nome   = await nomeSocieta(societaId);
    return inviaEmail(utente.email, 'iscrizione_decaduta', {
      nomeUtente:  `${utente.nome} ${utente.cognome}`.trim(),
      nomeSocieta: nome,
    });
  });
  await Promise.all(emailPromises);

  await creaNotificaAdmin(societaId, 'rinnovo_chiuso', {
    nuovoAnno, decaduti: daRinnovare.size,
  });

  return { success: true, decaduti: daRinnovare.size };
});

// ─────────────────────────────────────────────
// getIscritti (callable)
// Restituisce la lista degli iscritti di una società.
// Bypassa le limitazioni delle Security Rules sulle query list.
// ─────────────────────────────────────────────
exports.getIscritti = onCall({ region: REGION }, async (request) => {
  const { societaId } = request.data;
  await verificaAdmin(request, societaId);

  const snap = await db
    .collection('societa').doc(societaId)
    .collection('iscrizioni')
    .get();

  // Carica anche i dati anagrafici per ogni iscritto
  const iscrizioni = await Promise.all(
    snap.docs.map(async d => {
      const iscr    = d.data();
      const uSnap   = await db.collection('utenti').doc(d.id).get();
      return {
        id:         d.id,
        ...iscr,
        anagrafica: uSnap.exists ? uSnap.data() : null,
      };
    })
  );

  return { iscrizioni };
});

// ─────────────────────────────────────────────
// eliminaIscritto
// Rimuove l'iscrizione di un utente da una società.
// Se l'utente non ha altre iscrizioni attive, elimina anche l'account Auth.
// ─────────────────────────────────────────────
exports.eliminaIscritto = onCall({ region: REGION }, async (request) => {
  const { societaId, uid } = request.data;
  await verificaAdmin(request, societaId);

  const batch = db.batch();

  // 1. Rimuove iscrizione dalla società
  const iscrizioneRef = db.collection('societa').doc(societaId)
                          .collection('iscrizioni').doc(uid);
  batch.delete(iscrizioneRef);

  // 2. Rimuove relazioni (come genitore o come figlio) in questa società
  const relazioniGenitore = await db.collection('societa').doc(societaId)
    .collection('relazioni').where('genitoreUid', '==', uid).get();
  relazioniGenitore.docs.forEach(d => batch.delete(d.ref));

  const relazioniFiglio = await db.collection('societa').doc(societaId)
    .collection('relazioni').where('figlioUid', '==', uid).get();
  relazioniFiglio.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();

  // 3. Controlla se l'utente ha iscrizioni in altre società
  const tutteSocieta = await db.collection('societa').get();
  let haAltreIscrizioni = false;
  for (const s of tutteSocieta.docs) {
    if (s.id === societaId) continue;
    const snap = await db.collection('societa').doc(s.id)
                         .collection('iscrizioni').doc(uid).get();
    if (snap.exists) { haAltreIscrizioni = true; break; }
  }

  // 4. Se non ha altre iscrizioni, elimina anche l'account Auth e il documento utente
  if (!haAltreIscrizioni) {
    try {
      await admin.auth().deleteUser(uid);
    } catch (e) {
      // Il minore pre-registrato non ha ancora un account Auth — ignorato
    }
    await db.collection('utenti').doc(uid).delete();
  }

  return { eliminato: true, accountEliminato: !haAltreIscrizioni };
});

// ─────────────────────────────────────────────
// collegaUtentePreRegistrato
// Quando un figlio preRegistrato si registra con la propria email,
// aggiorna tutte le iscrizioni e relazioni dal vecchio UID al nuovo.
// ─────────────────────────────────────────────
exports.collegaUtentePreRegistrato = onCall({ region: REGION }, async (request) => {
  const { vecchioUid, nuovoUid } = request.data;
  if (!vecchioUid || !nuovoUid) throw new HttpsError('invalid-argument', 'UID mancanti');

  const tutteSocieta = await db.collection('societa').get();

  for (const societaDoc of tutteSocieta.docs) {
    const societaId = societaDoc.id;
    const batch     = db.batch();

    // Copia iscrizione dal vecchio UID al nuovo
    const iscrizioneVecchia = await db
      .collection('societa').doc(societaId)
      .collection('iscrizioni').doc(vecchioUid).get();

    if (iscrizioneVecchia.exists) {
      const nuovaIscrizioneRef = db
        .collection('societa').doc(societaId)
        .collection('iscrizioni').doc(nuovoUid);
      const datiIscrizione = iscrizioneVecchia.data();
      batch.set(nuovaIscrizioneRef, {
        ...datiIscrizione,
        uid: nuovoUid,
        statoAccount: datiIscrizione.statoAccount === 'pre_registrato'
          ? 'attesa_admin'
          : datiIscrizione.statoAccount,
        aggiornatoAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batch.delete(iscrizioneVecchia.ref);
    }

    // Aggiorna relazioni dove figlioUid == vecchioUid
    const relazioniFiglio = await db
      .collection('societa').doc(societaId)
      .collection('relazioni').where('figlioUid', '==', vecchioUid).get();

    relazioniFiglio.docs.forEach(d => {
      batch.update(d.ref, { figlioUid: nuovoUid });
    });

    if (!batch._ops || batch._ops.length > 0) {
      await batch.commit();
    }
  }

  // Elimina il vecchio documento utenti preRegistrato
  await db.collection('utenti').doc(vecchioUid).delete();

  return { collegato: true };
});

// ─────────────────────────────────────────────
// cercaPreRegistrato
// Cerca un documento utente preRegistrato con una certa email.
// Usato durante la registrazione per collegare automaticamente
// un figlio preRegistrato al nuovo account Auth.
// ─────────────────────────────────────────────
exports.cercaPreRegistrato = onCall({ region: REGION }, async (request) => {
  const { email } = request.data;
  if (!email) throw new HttpsError('invalid-argument', 'Email mancante');

  const snap = await db.collection('utenti')
    .where('email', '==', email)
    .where('preRegistrato', '==', true)
    .limit(1)
    .get();

  if (snap.empty) return { trovato: false };

  const doc = snap.docs[0];
  return {
    trovato:   true,
    vecchioUid: doc.id,
    dati:      doc.data(),
  };
});

// ─────────────────────────────────────────────
// aggiornaFcmToken
// Salva (o aggiorna) il token FCM dell'utente autenticato.
// ─────────────────────────────────────────────
exports.aggiornaFcmToken = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Accesso negato');
  const { token } = request.data;
  if (!token) throw new HttpsError('invalid-argument', 'Token mancante');

  await db.collection('utenti').doc(request.auth.uid).update({
    fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
  });
  return { success: true };
});

// ─────────────────────────────────────────────
// rimuoviFcmToken
// Rimuove il token FCM dell'utente (es. al logout).
// ─────────────────────────────────────────────
exports.rimuoviFcmToken = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Accesso negato');
  const { token } = request.data;
  if (!token) throw new HttpsError('invalid-argument', 'Token mancante');

  await db.collection('utenti').doc(request.auth.uid).update({
    fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
  });
  return { success: true };
});

// ─────────────────────────────────────────────
// onAvvisoCreato
// Trigger Firestore: invia push agli iscritti attivi
// quando viene pubblicato un nuovo avviso.
// ─────────────────────────────────────────────
exports.onAvvisoCreato = onDocumentCreated(
  { document: 'societa/{societaId}/avvisi/{avvisoId}', region: REGION },
  async (event) => {
    const avviso    = event.data.data();
    const { societaId, avvisoId } = event.params;

    console.error(`[onAvvisoCreato] START avvisoId=${avvisoId} societaId=${societaId} visibile=${avviso.visibile}`);
    const debugRef = db.collection('_pushDebug').doc(avvisoId);
    await debugRef.set({ avvisoId, societaId, visibile: avviso.visibile, step: 'start', ts: admin.firestore.FieldValue.serverTimestamp() });

    // Non inviare se l'avviso è una bozza
    if (!avviso.visibile) {
      console.error('[onAvvisoCreato] bozza, skip');
      await debugRef.update({ step: 'skip_bozza' });
      return;
    }

    const categorieTarget = avviso.categorieTarget || [];
    const isGenerale      = categorieTarget.length === 0;

    // Prende tutti gli iscritti attivi della società
    const iscrizioniSnap = await db
      .collection('societa').doc(societaId)
      .collection('iscrizioni')
      .where('statoAccount', '==', 'attivo')
      .get();

    console.error(`[onAvvisoCreato] iscritti attivi: ${iscrizioniSnap.size}`);

    // Filtra chi deve ricevere la notifica:
    // - Avviso generale (categorieTarget vuoto) → tutti gli iscritti attivi
    // - Avviso categorizzato → chi ha categoriaCalcolata in categorieTarget
    //                          + genitori con perFigli.categorieIds che interseca categorieTarget
    const uidsToNotify = [];
    for (const d of iscrizioniSnap.docs) {
      const dati = d.data();
      if (isGenerale) {
        uidsToNotify.push(d.id);
        continue;
      }
      // Atleta: la sua categoria è tra quelle target?
      if (dati.categoriaCalcolata && categorieTarget.includes(dati.categoriaCalcolata)) {
        uidsToNotify.push(d.id);
        continue;
      }
      // Genitore: ha figli in una delle categorie target?
      const catFigli = dati.preferenzeNotifiche?.perFigli?.categorieIds || [];
      if (catFigli.length > 0 && categorieTarget.some(c => catFigli.includes(c))) {
        uidsToNotify.push(d.id);
      }
    }

    console.error(`[onAvvisoCreato] uid da notificare: ${uidsToNotify.length}`);

    if (uidsToNotify.length === 0) {
      console.error('[onAvvisoCreato] nessun uid da notificare, skip');
      await debugRef.update({ step: 'skip_nessun_uid', iscrittiAttivi: iscrizioniSnap.size });
      return;
    }

    // Raccoglie i token FCM degli utenti selezionati
    const entries = []; // [{ token, uid }]
    await Promise.all(uidsToNotify.map(async uid => {
      const uSnap = await db.collection('utenti').doc(uid).get();
      if (!uSnap.exists) return;
      (uSnap.data().fcmTokens || []).forEach(t => entries.push({ token: t, uid }));
    }));

    console.error(`[onAvvisoCreato] token raccolti: ${entries.length}`);

    if (entries.length === 0) {
      console.error('[onAvvisoCreato] nessun token FCM trovato, skip');
      await debugRef.update({ step: 'skip_nessun_token', uidNotificati: uidsToNotify.length });
      return;
    }

    const bodyPreview = (avviso.corpo || '').substring(0, 120);
    const link        = `/${societaId}/avviso/${avvisoId}`;
    const invalidTokensByUid = {};
    let totSuccessi = 0;
    let totFalliti  = 0;

    // FCM accetta max 500 token per chiamata
    const CHUNK = 500;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk    = entries.slice(i, i + CHUNK);
      // Messaggio data-only: nessun campo notification a livello root.
      // Su Android Chrome i messaggi con notification vengono intercettati
      // dal browser e bypassano il push event del service worker.
      // Con solo data, il service worker gestisce sempre la visualizzazione.
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk.map(e => e.token),
        webpush: {
          data: {
            title:     avviso.titolo,
            body:      bodyPreview,
            societaId,
            avvisoId,
            url:       link,
          },
          fcmOptions: { link },
        },
      });

      response.responses.forEach((resp, idx) => {
        if (resp.success) {
          totSuccessi++;
        } else {
          totFalliti++;
          const code = resp.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            const { token, uid } = chunk[idx];
            if (!invalidTokensByUid[uid]) invalidTokensByUid[uid] = [];
            invalidTokensByUid[uid].push(token);
          }
        }
      });
    }

    // Rimuove i token scaduti da Firestore
    const tokensRimossi = Object.values(invalidTokensByUid).reduce((s, arr) => s + arr.length, 0);
    await Promise.all(
      Object.entries(invalidTokensByUid).map(([uid, badTokens]) =>
        db.collection('utenti').doc(uid).update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...badTokens),
        })
      )
    );

    // Segna l'avviso come "push inviata" e salva statistiche
    await event.data.ref.update({ pushInviata: true });
    await debugRef.update({
      step:           'completato',
      iscrittiAttivi: iscrizioniSnap.size,
      uidNotificati:  uidsToNotify.length,
      tokenInviati:   entries.length,
      tokenSuccesso:  totSuccessi,
      tokenFalliti:   totFalliti,
      tokenRimossi:   tokensRimossi,
      completatoAt:   admin.firestore.FieldValue.serverTimestamp(),
    });
    console.error('[onAvvisoCreato] completato');
  }
);

// ─────────────────────────────────────────────
// modificaIscritto
// Aggiorna anagrafica e iscrizione di un utente.
// Usato dall'admin per modificare i dati di un iscritto.
// ─────────────────────────────────────────────
exports.modificaIscritto = onCall({ region: REGION }, async (request) => {
  const { societaId, uid, anagrafica, iscrizione } = request.data;
  await verificaAdmin(request, societaId);

  const batch = db.batch();

  // Aggiorna anagrafica globale
  batch.update(db.collection('utenti').doc(uid), {
    ...anagrafica,
    aggiornatoAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Aggiorna iscrizione
  batch.update(
    db.collection('societa').doc(societaId).collection('iscrizioni').doc(uid),
    {
      ...iscrizione,
      aggiornatoAt: admin.firestore.FieldValue.serverTimestamp(),
    }
  );

  await batch.commit();
  return { aggiornato: true };
});

// ─────────────────────────────────────────────
// inviaMessaggioIscritti
// ─────────────────────────────────────────────
exports.inviaMessaggioIscritti = onCall({ region: REGION }, async (request) => {
  const { societaId, uids, oggetto, testo } = request.data;
  await verificaAdmin(request, societaId);

  if (!uids || !Array.isArray(uids) || uids.length === 0)
    throw new HttpsError('invalid-argument', 'Nessun destinatario selezionato');
  if (!oggetto || !oggetto.trim())
    throw new HttpsError('invalid-argument', 'Oggetto obbligatorio');
  if (!testo || !testo.trim())
    throw new HttpsError('invalid-argument', 'Testo obbligatorio');

  await db.collection('societa').doc(societaId).collection('avvisi').add({
    titolo:          oggetto.trim(),
    corpo:           testo.trim(),
    visibile:        true,
    pinned:          false,
    categorieTarget: [],
    destinatariUid:  uids,
    autoreUid:       request.auth.uid,
    dataCreazione:   TS(),
    links:           [],
    pushInviata:     false,
  });

  return { success: true, inviati: uids.length };
});

// ─────────────────────────────────────────────
// aggiornaCategorieeStagione
// Aggiorna configCategorie/corrente e ricalcola categoriaCalcolata
// su tutte le iscrizioni attive di ogni società.
// ─────────────────────────────────────────────
exports.aggiornaCategorieeStagione = onCall({ region: REGION }, async (request) => {
  const { societaId, stagione, categorie } = request.data;
  await verificaAdmin(request, societaId);

  if (!stagione || typeof stagione !== 'string') {
    throw new HttpsError('invalid-argument', 'stagione mancante');
  }
  if (!Array.isArray(categorie) || categorie.length === 0) {
    throw new HttpsError('invalid-argument', 'categorie mancanti');
  }

  // 1. Aggiorna configCategorie/corrente
  await db.collection('configCategorie').doc('corrente').set({
    stagione,
    categorie,
    aggiornatoAt: TS(),
  });

  // 2. Ricalcola su tutte le società
  const societaSnap = await db.collection('societa').get();
  let aggiornati = 0;
  const CHUNK = 400;

  for (const sDoc of societaSnap.docs) {
    const sid = sDoc.id;
    const iscrizioniSnap = await db
      .collection('societa').doc(sid)
      .collection('iscrizioni')
      .where('statoAccount', '==', 'attivo')
      .where('ruoli', 'array-contains', 'atleta')
      .get();

    const docs = iscrizioniSnap.docs;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const chunk = docs.slice(i, i + CHUNK);
      const batch = db.batch();

      await Promise.all(chunk.map(async snap => {
        const uid    = snap.id;
        const utente = await datiUtente(uid);
        if (!utente.dataNascita) return;

        const nuovaCategoria = calcolaCategoria(categorie, utente.dataNascita);
        batch.update(snap.ref, {
          categoriaCalcolata:              nuovaCategoria,
          'preferenzeNotifiche.proprie':   buildPreferenzeProprie(categorie, utente.dataNascita),
          aggiornatoAt:                    TS(),
        });
        aggiornati++;
      }));

      await batch.commit();
    }

    // 3. Ricalcola perFigli per tutti i genitori di questa società
    const relazioniSnap = await db
      .collection('societa').doc(sid)
      .collection('relazioni').get();

    const genitoriUid = [...new Set(relazioniSnap.docs.map(d => d.data().genitoreUid))];

    for (let i = 0; i < genitoriUid.length; i += CHUNK) {
      const chunk = genitoriUid.slice(i, i + CHUNK);
      const batch = db.batch();

      await Promise.all(chunk.map(async genitoreUid => {
        const relFigli = relazioniSnap.docs.filter(d => d.data().genitoreUid === genitoreUid);
        const categorieIdsFigli = await Promise.all(
          relFigli.map(async d => {
            const fSnap = await db
              .collection('societa').doc(sid)
              .collection('iscrizioni').doc(d.data().figlioUid)
              .get();
            return fSnap.exists
              ? (fSnap.data().preferenzeNotifiche?.proprie?.categorieIds || [])
              : [];
          })
        );
        const ref = db.collection('societa').doc(sid).collection('iscrizioni').doc(genitoreUid);
        batch.update(ref, {
          'preferenzeNotifiche.perFigli': buildPreferenzePerFigli(categorieIdsFigli),
          aggiornatoAt: TS(),
        });
      }));

      await batch.commit();
    }
  }

  return { success: true, stagione, aggiornati };
});
