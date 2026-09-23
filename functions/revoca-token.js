/**
 * revoca-token.js
 * Revoca i refresh token di tutti gli utenti Firebase Auth.
 * Gli utenti vengono disconnessi e dovranno fare login di nuovo.
 *
 * Uso:
 *   node revoca-token.js
 *   node revoca-token.js --uid abc123   (solo un utente specifico)
 */

const admin = require('firebase-admin');

admin.initializeApp();

const soloUid = process.argv.includes('--uid')
  ? process.argv[process.argv.indexOf('--uid') + 1]
  : null;

async function revocaTutti() {
  let revocati = 0;
  let errori   = 0;
  let pageToken;

  do {
    const result = await admin.auth().listUsers(100, pageToken);
    for (const user of result.users) {
      try {
        await admin.auth().revokeRefreshTokens(user.uid);
        console.log(`✓ ${user.email || user.uid}`);
        revocati++;
      } catch (e) {
        console.error(`✗ ${user.email || user.uid}: ${e.message}`);
        errori++;
      }
    }
    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`\nFatto: ${revocati} revocati, ${errori} errori.`);
}

async function revocaUno(uid) {
  await admin.auth().revokeRefreshTokens(uid);
  console.log(`✓ Token revocato per uid: ${uid}`);
}

(soloUid ? revocaUno(soloUid) : revocaTutti()).catch(e => {
  console.error('Errore fatale:', e.message);
  process.exit(1);
});
