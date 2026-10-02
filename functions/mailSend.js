/**
 * mailSend.js — Invio email da collection 'mail' (sostituisce l'estensione
 * Firebase "firestore-send-email", deprecata — Google dismette Firebase
 * Extensions il 31 marzo 2027: dopo quella data l'estensione resta attiva
 * ma non più aggiornabile/disinstallabile dalla console).
 *
 * Replica il comportamento già usato da auth.js/admin.js (inviaEmail()):
 *   db.collection('mail').add({ to, template: { name, data } })
 *
 * Config non sensibile (functions/.env):
 *   MAIL_TEMPLATES_COLLECTION  collection dei template Handlebars (default: 'templates')
 *   MAIL_DEFAULT_FROM          mittente di default — DA IMPOSTARE
 *   MAIL_DEFAULT_REPLY_TO      reply-to di default (opzionale)
 *
 * Secret (Secret Manager):
 *   SMTP_CONNECTION_URI        es. smtps://a7fd6a001@smtp-brevo.com:PASSWORD@smtp-relay.brevo.com:465
 *   Da impostare con: firebase functions:secrets:set SMTP_CONNECTION_URI
 */

const { onDocumentCreated }          = require('firebase-functions/v2/firestore');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');
const Handlebars = require('handlebars');

if (!admin.apps.length) admin.initializeApp();

const db     = admin.firestore();
const REGION = 'europe-west1';

const SMTP_CONNECTION_URI  = defineSecret('SMTP_CONNECTION_URI');
const TEMPLATES_COLLECTION = defineString('MAIL_TEMPLATES_COLLECTION', { default: 'templates' });
const DEFAULT_FROM         = defineString('MAIL_DEFAULT_FROM',         { default: '' });
const DEFAULT_REPLY_TO     = defineString('MAIL_DEFAULT_REPLY_TO',     { default: '' });

let transporter = null;
function getTransporter() {
  if (!transporter) transporter = nodemailer.createTransport(SMTP_CONNECTION_URI.value());
  return transporter;
}

function compila(stringa, contesto) {
  return stringa ? Handlebars.compile(stringa)(contesto || {}) : stringa;
}

async function caricaTemplate(nome, dati) {
  const snap = await db.collection(TEMPLATES_COLLECTION.value()).doc(nome).get();
  if (!snap.exists) {
    throw new Error(`Template "${nome}" non trovato in "${TEMPLATES_COLLECTION.value()}"`);
  }
  const tpl = snap.data();
  return {
    subject: compila(tpl.subject, dati),
    text:    compila(tpl.text,    dati),
    html:    compila(tpl.html,    dati),
  };
}

// ─────────────────────────────────────────────
// onMailCreata — Firestore trigger su mail/{mailId}
// Sostituisce l'estensione firebase/firestore-send-email.
//
// ATTENZIONE: finché l'estensione "firestore-send-email" resta installata,
// questa function NON va deployata — altrimenti ogni documento in
// mail/{mailId} verrebbe spedito due volte. Deploy e disinstallazione
// dell'estensione vanno fatti insieme.
// ─────────────────────────────────────────────
exports.onMailCreata = onDocumentCreated(
  { document: 'mail/{mailId}', region: REGION, secrets: [SMTP_CONNECTION_URI] },
  async (event) => {
    const ref  = event.data.ref;
    const dati = event.data.data();

    if (dati.delivery && dati.delivery.state === 'SUCCESS') return;

    try {
      let messaggio = dati.message || {};

      if (dati.template && dati.template.name) {
        const renderizzato = await caricaTemplate(dati.template.name, dati.template.data);
        messaggio = {
          subject: messaggio.subject || renderizzato.subject,
          text:    messaggio.text    || renderizzato.text,
          html:    messaggio.html    || renderizzato.html,
        };
      }

      const mailOptions = {
        from:        dati.from || DEFAULT_FROM.value() || undefined,
        replyTo:     dati.replyTo || DEFAULT_REPLY_TO.value() || undefined,
        to:          dati.to,
        cc:          dati.cc,
        bcc:         dati.bcc,
        subject:     messaggio.subject,
        text:        messaggio.text,
        html:        messaggio.html,
        headers:     dati.headers,
        attachments: dati.attachments,
      };

      const info = await getTransporter().sendMail(mailOptions);

      await ref.update({
        delivery: {
          state:    'SUCCESS',
          endTime:  admin.firestore.FieldValue.serverTimestamp(),
          info:     { messageId: info.messageId || null, accepted: info.accepted || [] },
        },
      });
    } catch (err) {
      await ref.update({
        delivery: {
          state:   'ERROR',
          endTime: admin.firestore.FieldValue.serverTimestamp(),
          error:   err.message,
        },
      });
      console.error(`[onMailCreata] invio fallito per mail/${event.params.mailId}:`, err);
    }
  }
);
