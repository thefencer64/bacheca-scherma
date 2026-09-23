/**
 * pulisci-consensi.js
 * Elimina i documenti in consensiPrivacy il cui uid non esiste più in Firebase Auth.
 * 
 * Esecuzione:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/serviceAccountKey.json node pulisci-consensi.js
 */

const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const db   = admin.firestore();
const auth = admin.auth();

async function main() {
  console.log('Carico tutti gli utenti da Firebase Auth...');

  // Carica tutti gli UID da Auth (paginato a 1000 per volta)
  const uidValidi = new Set();
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    result.users.forEach(u => uidValidi.add(u.uid));
    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`Trovati ${uidValidi.size} utenti in Auth.`);

  // Carica tutti i documenti consensiPrivacy
  console.log('Carico i documenti consensiPrivacy...');
  const snap = await db.collection('consensiPrivacy').get();
  console.log(`Trovati ${snap.size} documenti in consensiPrivacy.`);

  // Trova quelli orfani
  const orfani = [];
  snap.docs.forEach(d => {
    const uid = d.id.split('_')[0]; // formato: {uid}_{societaId}_{versione}
    if (!uidValidi.has(uid)) {
      orfani.push(d.ref);
      console.log(`  Orfano: ${d.id} (uid: ${uid})`);
    }
  });

  if (orfani.length === 0) {
    console.log('\nNessun documento orfano trovato. Tutto pulito!');
    return;
  }

  console.log(`\nTrovati ${orfani.length} documenti orfani.`);
  console.log('Vuoi eliminarli? (scrivi "sì" e premi Invio)');

  // Attendi conferma
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  await new Promise(resolve => {
    rl.question('> ', async (risposta) => {
      rl.close();
      if (risposta.trim().toLowerCase() === 'sì' || risposta.trim().toLowerCase() === 'si') {
        // Elimina in batch
        const batchSize = 500;
        for (let i = 0; i < orfani.length; i += batchSize) {
          const batch = db.batch();
          orfani.slice(i, i + batchSize).forEach(ref => batch.delete(ref));
          await batch.commit();
        }
        console.log(`Eliminati ${orfani.length} documenti.`);
      } else {
        console.log('Operazione annullata.');
      }
      resolve();
    });
  });
}

main().catch(console.error).finally(() => process.exit(0));
