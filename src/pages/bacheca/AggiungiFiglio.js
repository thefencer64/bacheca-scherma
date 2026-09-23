import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  doc, getDoc, getDocs, setDoc, addDoc, collection, query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

export default function AggiungiFiglio() {
  const { societaId }   = useParams();
  const { utente }      = useAuth();
  const navigate        = useNavigate();

  const [societa, setSocieta]         = useState(null);
  const [privacyPolicy, setPrivacyPolicy] = useState(null);
  const [step, setStep]               = useState(1); // 1=dati figlio, 2=privacy
  const [caricamento, setCaricamento]   = useState(false);
  const [errore, setErrore]             = useState('');
  const [datiFiglio, setDatiFiglio]     = useState(null);
  const [figlioEsistente, setFiglioEsistente] = useState(null); // uid pre-registrato già presente

  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    if (!societaId) return;
    Promise.all([
      getDoc(doc(db, 'societa', societaId)),
      getDoc(doc(db, 'configPrivacy', 'corrente')),
    ]).then(([sSnap, pSnap]) => {
      if (sSnap.exists()) setSocieta({ id: sSnap.id, ...sSnap.data() });
      if (pSnap.exists()) setPrivacyPolicy(pSnap.data());
    });
  }, [societaId]);

  async function onStep1(dati) {
    // Controlla che il figlio sia minorenne
    const oggi = new Date();
    const nascita = new Date(dati.dataNascita);
    const eta = oggi.getFullYear() - nascita.getFullYear() -
      (oggi < new Date(oggi.getFullYear(), nascita.getMonth(), nascita.getDate()) ? 1 : 0);

    if (eta >= 18) {
      alert(
        `${dati.nome} ha ${eta} anni ed è maggiorenne.\n\n` +
        `I maggiorenni devono registrarsi autonomamente tramite la pagina di registrazione.`
      );
      return;
    }

    // Controlla se il figlio è già pre-registrato da un altro genitore
    setFiglioEsistente(null);
    try {
      const preRegSnap = await getDocs(query(
        collection(db, 'societa', societaId, 'iscrizioni'),
        where('statoAccount', '==', 'pre_registrato')
      ));
      for (const d of preRegSnap.docs) {
        const uSnap = await getDoc(doc(db, 'utenti', d.id));
        if (!uSnap.exists()) continue;
        const u = uSnap.data();
        if (
          u.nome?.trim().toLowerCase() === dati.nome.trim().toLowerCase() &&
          u.cognome?.trim().toLowerCase() === dati.cognome.trim().toLowerCase() &&
          u.dataNascita === dati.dataNascita
        ) {
          setFiglioEsistente(d.id);
          break;
        }
      }
    } catch (e) {
      console.error('Errore ricerca pre-registrato:', e);
    }

    setDatiFiglio(dati);
    setStep(2);
  }

  async function onStep2(dati) {
    setCaricamento(true);
    setErrore('');

    try {
      const ip = await fetch('https://api.ipify.org?format=json')
        .then(r => r.json()).then(d => d.ip).catch(() => 'unknown');

      const versione  = privacyPolicy?.versione || '1.0';
      const figlioUid = figlioEsistente || doc(collection(db, 'utenti')).id;

      if (!figlioEsistente) {
        // Nuovo pre-registrato: crea utente e iscrizione
        await setDoc(doc(db, 'utenti', figlioUid), {
          uid:           figlioUid,
          email:         datiFiglio.email || '',
          nome:          datiFiglio.nome,
          cognome:       datiFiglio.cognome,
          dataNascita:   datiFiglio.dataNascita,
          telefono:      '',
          fcmTokens:     [],
          preRegistrato: true,
          genitoreUid:   utente.uid,
          creatoAt:      serverTimestamp(),
        });

        await setDoc(
          doc(db, 'societa', societaId, 'iscrizioni', figlioUid),
          {
            uid:             figlioUid,
            ruoli:           ['atleta'],
            statoAccount:    'pre_registrato',
            annoIscrizione:  societa?.annoSchermistico || '',
            preferenzeNotifiche: {
              proprie: { tutteLeCategorie: true, categorieIds: [], generale: true }
            },
            iscrittoAt:   serverTimestamp(),
            aggiornatoAt: serverTimestamp(),
          }
        );
      }

      // Registra consenso privacy per conto del figlio
      await setDoc(
        doc(db, 'consensiPrivacy', `${figlioUid}_${societaId}_${versione}`),
        {
          uid:         figlioUid,
          societaId,
          accettatoDa: utente.uid,
          versione,
          accettato:   true,
          timestamp:   serverTimestamp(),
          ip,
          userAgent:   navigator.userAgent,
          perConto:    true,
          figlioUid,
        }
      );

      // Crea relazione genitore-figlio (anche se il figlio esisteva già)
      await addDoc(
        collection(db, 'societa', societaId, 'relazioni'),
        {
          genitoreUid: utente.uid,
          figlioUid,
          consensoAt:  serverTimestamp(),
          consensoIP:  ip,
          prefGenitore: {
            tutteLeCategorie: true,
            categorieIds:    [],
            generale:        true,
            erediFiglio:     true,
          },
        }
      );

      navigate(`/${societaId}/profilo`);
    } catch (e) {
      console.error('ERRORE:', e.code, e.message, e);
      setErrore('Errore durante l\'aggiunta. Riprova.');
    } finally {
      setCaricamento(false);
    }
  }

  if (!societa) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-scherma-blue border-t-transparent
                      rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center
                    px-4 py-8 overflow-y-auto overflow-x-hidden">

      <div className="mb-6 text-center">
        <div className="w-16 h-16 bg-scherma-navy rounded-2xl flex items-center
                        justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">
            {societa.nome?.charAt(0)}
          </span>
        </div>
        <h1 className="text-xl font-bold text-scherma-navy">Aggiungi figlio</h1>
        <p className="text-gray-500 text-sm mt-1">{societa.nome}</p>
      </div>

      {/* Indicatore step */}
      <div className="flex gap-2 mb-6">
        {[1,2].map(s => (
          <div key={s} className={`h-1.5 w-8 rounded-full transition-colors
            ${s <= step ? 'bg-scherma-blue' : 'bg-gray-200'}`} />
        ))}
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm
                      border border-gray-100 p-6">

        {step === 1 && (
          <form onSubmit={handleSubmit(onStep1)} className="space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">
                Dati del figlio/a
              </h2>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input type="text"
                    className="w-full px-3 py-3 rounded-xl border border-gray-200
                               focus:outline-none focus:ring-2 focus:ring-scherma-blue"
                    style={{ fontSize: '16px' }}
                    {...register('nome', { required: 'Obbligatorio' })}
                  />
                  {errors.nome && (
                    <p className="text-red-500 text-xs mt-1">{errors.nome.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cognome
                  </label>
                  <input type="text"
                    className="w-full px-3 py-3 rounded-xl border border-gray-200
                               focus:outline-none focus:ring-2 focus:ring-scherma-blue"
                    style={{ fontSize: '16px' }}
                    {...register('cognome', { required: 'Obbligatorio' })}
                  />
                  {errors.cognome && (
                    <p className="text-red-500 text-xs mt-1">{errors.cognome.message}</p>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data di nascita
                </label>
                <input type="date"
                  className="w-full px-3 py-3 rounded-xl border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-scherma-blue
                             text-sm"
                  {...register('dataNascita', { required: 'Obbligatoria' })}
                />
                {errors.dataNascita && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.dataNascita.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (opzionale)
                </label>
                <input type="email"
                  className="w-full px-3 py-3 rounded-xl border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-scherma-blue
                             text-sm"
                  placeholder="Per future notifiche dirette"
                  {...register('email')}
                />
              </div>
            </div>

            <button type="submit"
              className="w-full bg-scherma-blue text-white py-3 rounded-xl
                         font-medium text-sm">
              Avanti
            </button>

            <button type="button" onClick={() => navigate(-1)}
              className="w-full text-gray-400 text-sm py-2">
              Annulla
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit(onStep2)} className="space-y-4">
            <h2 className="font-semibold text-gray-900 mb-1">
              Consenso privacy per {datiFiglio?.nome}
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              In qualità di genitore/tutore, acconsenti al trattamento
              dei dati del minore.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 max-h-40
                            overflow-y-auto text-xs text-gray-600 leading-relaxed">
              <p className="font-medium text-gray-800 mb-2">
                Informativa privacy — {societa.ragioneSociale || societa.nome}
                — v{privacyPolicy?.versione || '1.0'}
              </p>
              <p>
                I dati personali di <strong>{datiFiglio?.nome} {datiFiglio?.cognome}</strong>{' '}
                verranno trattati da <strong>{societa.ragioneSociale || societa.nome}</strong> per
                inviargli/le avvisi relativi alle attività del club.
                I dati non vengono ceduti a terzi.
              </p>
              <a href={`https://bachecascherma.it/privacy.html?societa=${encodeURIComponent(societa.ragioneSociale || societa.nome || '')}&indirizzo=${encodeURIComponent(societa.indirizzo || '')}&cf=${encodeURIComponent(societa.codiceFiscale || '')}&email=${encodeURIComponent(societa.emailPrivacy || societa.emailNotifiche || '')}&versione=${privacyPolicy?.versione || '1.0'}&data=${encodeURIComponent(new Date().toLocaleDateString('it-IT'))}`}
                 target="_blank" rel="noreferrer"
                 className="text-scherma-blue underline mt-1 block text-xs">
                Leggi il testo completo
              </a>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox"
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-scherma-blue"
                {...register('accettaPrivacy', {
                  required: 'Devi accettare per procedere'
                })}
              />
              <span className="text-sm text-gray-700">
                Acconsento, in qualità di genitore/tutore legale, al trattamento
                dei dati personali di <strong>{datiFiglio?.nome}</strong> da parte
                di <strong>{societa.nome}</strong>
              </span>
            </label>
            {errors.accettaPrivacy && (
              <p className="text-red-500 text-xs">{errors.accettaPrivacy.message}</p>
            )}

            {errore && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{errore}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl border border-gray-200
                           text-sm font-medium text-gray-700">
                Indietro
              </button>
              <button type="submit" disabled={caricamento}
                className="flex-1 bg-scherma-blue text-white py-3 rounded-xl
                           font-medium text-sm disabled:opacity-50">
                {caricamento ? 'Invio...' : 'Conferma'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
