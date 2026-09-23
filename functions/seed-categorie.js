/**
 * seed-categorie.js
 * Categorie FIS stagione 2025-2026 — versione aggiornata con Paralimpico e Integrata
 * 
 * Esecuzione:
 *   cd ~/bacheca-scherma/functions
 *   GOOGLE_APPLICATION_CREDENTIALS=~/serviceAccountKey.json node seed-categorie.js
 */

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const STAGIONE = '2025-2026';

const categorie = [
  // ── Generale ────────────────────────────────────────────────────
  {
    id: 'generale', etichetta: 'Avvisi generali',
    anniNascita: [], isMaster: false, sottocategoria: null,
    dataNascitaDal: null, dataNascitaAl: null, ordine: 0,
  },

  // ── Minions (nati dal 2016 in poi — troppo giovani per le categorie FIS) ──
  {
    id: 'minions', etichetta: 'Minions',
    anniNascita: [], isMaster: false, isSpeciale: false, sottocategoria: null,
    dataNascitaDal: '2016-01-01', dataNascitaAl: null, ordine: 0,
  },

  // ── Gran Premio Giovanissimi ─────────────────────────────────────
  {
    id: 'bambini', etichetta: 'Bambine / Maschietti',
    anniNascita: [2015], isMaster: false, sottocategoria: null,
    dataNascitaDal: null, dataNascitaAl: null, ordine: 1,
  },
  {
    id: 'giovanissimi', etichetta: 'Giovanissime / Giovanissimi',
    anniNascita: [2014], isMaster: false, sottocategoria: null,
    dataNascitaDal: null, dataNascitaAl: null, ordine: 2,
  },
  {
    id: 'ragazzi', etichetta: 'Ragazze / Ragazzi',
    anniNascita: [2013], isMaster: false, sottocategoria: null,
    dataNascitaDal: null, dataNascitaAl: null, ordine: 3,
  },
  {
    id: 'allievi', etichetta: 'Allieve / Allievi',
    anniNascita: [2012], isMaster: false, sottocategoria: null,
    dataNascitaDal: null, dataNascitaAl: null, ordine: 4,
  },

  // ── Gran Premio Giovani ──────────────────────────────────────────
  {
    id: 'cadetti', etichetta: 'Cadetti (M/F)',
    anniNascita: [2011, 2010, 2009], isMaster: false, sottocategoria: null,
    dataNascitaDal: null, dataNascitaAl: null, ordine: 5,
  },
  {
    id: 'giovani', etichetta: 'Giovani (M/F)',
    anniNascita: [2008, 2007, 2006], isMaster: false, sottocategoria: null,
    dataNascitaDal: null, dataNascitaAl: null, ordine: 6,
  },

  // ── Gran Premio Assoluti ─────────────────────────────────────────
  {
    id: 'under23', etichetta: 'Under 23',
    anniNascita: [], isMaster: false, sottocategoria: null,
    dataNascitaDal: '2003-01-01', dataNascitaAl: '2005-12-31', ordine: 7,
  },
  {
    id: 'assoluti', etichetta: 'Assoluti',
    anniNascita: [], isMaster: false, sottocategoria: null,
    dataNascitaDal: '2003-01-01', dataNascitaAl: '2011-12-31', ordine: 13,
  },

  // ── Gran Premio Seniores — Master ────────────────────────────────
  {
    id: 'master_0', etichetta: 'Master — Cat. 0 (over 24)',
    anniNascita: [], isMaster: true, sottocategoria: '0',
    dataNascitaDal: '1987-01-01', dataNascitaAl: '2002-12-31', ordine: 13,
  },
  {
    id: 'master_1', etichetta: 'Master — Cat. 1 (over 40)',
    anniNascita: [], isMaster: true, sottocategoria: '1',
    dataNascitaDal: '1977-01-01', dataNascitaAl: '1986-12-31', ordine: 13,
  },
  {
    id: 'master_2', etichetta: 'Master — Cat. 2 (over 50)',
    anniNascita: [], isMaster: true, sottocategoria: '2',
    dataNascitaDal: '1967-01-01', dataNascitaAl: '1976-12-31', ordine: 13,
  },
  {
    id: 'master_3', etichetta: 'Master — Cat. 3 (over 60)',
    anniNascita: [], isMaster: true, sottocategoria: '3',
    dataNascitaDal: '1957-01-01', dataNascitaAl: '1966-12-31', ordine: 13,
  },
  {
    id: 'master_4', etichetta: 'Master — Cat. 4 (over 70)',
    anniNascita: [], isMaster: true, sottocategoria: '4',
    dataNascitaDal: null, dataNascitaAl: '1956-12-31', ordine: 13,
  },

  // ── Categorie speciali (nessun vincolo di età) ──────────────────
  // L'appartenenza è determinata dalla classificazione medico-sportiva

  // Gran Premio Paralimpico — atleti con disabilità fisiche (es. carrozzina)
  {
    id: 'paralimpico', etichetta: 'Paralimpico',
    anniNascita: [], isMaster: false, isSpeciale: true, sottocategoria: null,
    dataNascitaDal: null, dataNascitaAl: null, ordine: 13,
  },

  // Gran Premio Scherma Integrata — atleti con disabilità cognitive/relazionali
  {
    id: 'integrata', etichetta: 'Scherma Integrata',
    anniNascita: [], isMaster: false, isSpeciale: true, sottocategoria: null,
    dataNascitaDal: null, dataNascitaAl: null, ordine: 14,
  },

  // Scherma Non Vedenti — sezione autonoma FIS
  {
    id: 'non_vedenti', etichetta: 'Non Vedenti',
    anniNascita: [], isMaster: false, isSpeciale: true, sottocategoria: null,
    dataNascitaDal: null, dataNascitaAl: null, ordine: 15,
  },
];

async function seed() {
  await db.collection('configCategorie').doc('corrente').set({
    stagione: STAGIONE,
    categorie,
    aggiornatoAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✓ Categorie stagione ${STAGIONE} aggiornate (${categorie.length} voci)`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
