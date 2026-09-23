/**
 * pulizia-genitori.js
 * Rimuove `categoriaCalcolata` e `preferenzeNotifiche.proprie` dalle iscrizioni
 * di utenti che NON hanno il ruolo `atleta` (puri genitori).
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node pulizia-genitori.js
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node pulizia-genitori.js --societaId brianzascherma
 */

const admin = require('firebase-admin');

const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccount) {
  console.error('Errore: GOOGLE_APPLICATION_CREDENTIALS non impostato.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });

const db     = admin.firestore();
const DELETE = admin.firestore.FieldValue.delete();

const args        = process.argv.slice(2);
const idxSocieta  = args.indexOf('--societaId');
const societaFiltro = idxSocieta !== -1 ? args[idxSocieta + 1] : null;

async function pulisci() {
  // Recupera le società da processare
  const societaSnap = societaFiltro
    ? await db.collection('societa').doc(societaFiltro).get().then(s => s.exists ? [s] : [])
    : await db.collection('societa').get().then(s => s.docs);

  if (societaSnap.length === 0) {
    console.log('Nessuna società trovata.');
    return;
  }

  let totale = 0, modificati = 0, errori = 0;

  for (const societaDoc of societaSnap) {
    const societaId = societaDoc.id;
    const iscrizioniSnap = await db
      .collection('societa').doc(societaId)
      .collection('iscrizioni')
      .get();

    for (const doc of iscrizioniSnap.docs) {
      totale++;
      const dati = doc.data();
      const ruoli = dati.ruoli || [];

      // Solo genitori puri (nessun ruolo atleta)
      if (ruoli.includes('atleta')) continue;

      const update = {};
      if (dati.categoriaCalcolata !== undefined) {
        update.categoriaCalcolata = DELETE;
      }
      if (dati.preferenzeNotifiche?.proprie !== undefined) {
        update['preferenzeNotifiche.proprie'] = DELETE;
      }

      if (Object.keys(update).length === 0) continue;

      try {
        await doc.ref.update(update);
        console.log(`  ✓ ${societaId}/${doc.id} — rimosso: ${Object.keys(update).join(', ')}`);
        modificati++;
      } catch (e) {
        console.error(`  ✗ ${societaId}/${doc.id} — ${e.message}`);
        errori++;
      }
    }
  }

  console.log(`\nFatto: ${modificati} modificati, ${errori} errori (su ${totale} iscrizioni totali).`);
}

pulisci().catch(e => { console.error(e); process.exit(1); });
