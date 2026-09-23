import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  doc, getDoc, setDoc, collection, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

const CATEGORIE_GRUPPI = [
  { id: 'minions',      label: 'Minions' },
  { id: 'generale',     label: 'Avvisi generali' },
  { id: 'bambini',      label: 'Bambine/Maschietti' },
  { id: 'giovanissimi', label: 'Giovanissimi' },
  { id: 'ragazzi',      label: 'Ragazze/Ragazzi' },
  { id: 'allievi',      label: 'Allieve/Allievi' },
  { id: 'cadetti',      label: 'Cadetti' },
  { id: 'giovani',      label: 'Giovani' },
  { id: 'assoluti',     label: 'Assoluti' },
  { id: 'master_0',     label: 'Master Cat.0 (over 24)' },
  { id: 'master_1',     label: 'Master Cat.1 (over 40)' },
  { id: 'master_2',     label: 'Master Cat.2 (over 50)' },
  { id: 'master_3',     label: 'Master Cat.3 (over 60)' },
  { id: 'master_4',     label: 'Master Cat.4 (over 70)' },
  { id: 'paralimpico',  label: 'Paralimpico' },
  { id: 'integrata',    label: 'Scherma Integrata' },
  { id: 'non_vedenti',  label: 'Non Vedenti' },
];

export default function Iscrizione() {
  const { societaId }   = useParams();
  const { utente }      = useAuth();
  const navigate        = useNavigate();

  const [societa, setSocieta]         = useState(null);
  const [privacyPolicy, setPrivacyPolicy] = useState(null);
  const [categorieCalcolate, setCategorieCalcolate] = useState([]);
  const [step, setStep]               = useState(1); // 1=ruolo, 2=categorie, 3=privacy
  const [ruoliScelti, setRuoliScelti] = useState([]);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore]           = useState('');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { tutteLeCategorie: true, categorieIds: [] }
  });

  const tutteLeCategorie = watch('tutteLeCategorie');

  // Guard: se l'utente ha già un'iscrizione, reindirizza subito
  useEffect(() => {
    if (!utente || !societaId) return;
    getDoc(doc(db, 'societa', societaId, 'iscrizioni', utente.uid)).then(snap => {
      if (!snap.exists()) return;
      const stato = snap.data().statoAccount;
      if (stato === 'attivo') {
        navigate(`/${societaId}`, { replace: true });
      } else if (stato && stato !== 'pre_registrato') {
        navigate(`/stato-iscrizione/${societaId}`, { replace: true });
      }
    }).catch(() => {});
  }, [utente, societaId]);

  useEffect(() => {
    if (!societaId) return;
    Promise.all([
      getDoc(doc(db, 'societa', societaId)),
      getDoc(doc(db, 'configPrivacy', 'corrente')),
      getDoc(doc(db, 'configCategorie', 'corrente')),
      getDoc(doc(db, 'utenti', utente.uid)),
    ]).then(([sSnap, pSnap, cSnap, uSnap]) => {
      if (sSnap.exists()) setSocieta({ id: sSnap.id, ...sSnap.data() });
      if (pSnap.exists()) setPrivacyPolicy(pSnap.data());

      // Calcola categoria dell'utente dalla data di nascita
      if (cSnap.exists() && uSnap.exists()) {
        const { categorie } = cSnap.data();
        const { dataNascita } = uSnap.data();
        if (dataNascita) {
          const anno = parseInt(dataNascita.substring(0, 4), 10);
          const data = new Date(dataNascita);
          const trovate = [];
          categorie.forEach(cat => {
            if (cat.anniNascita?.includes(anno)) {
              trovate.push(cat.id);
            } else if (cat.dataNascitaDal || cat.dataNascitaAl) {
              const dal = cat.dataNascitaDal ? new Date(cat.dataNascitaDal) : null;
              const al  = cat.dataNascitaAl  ? new Date(cat.dataNascitaAl)  : null;
              if ((!dal || data >= dal) && (!al || data <= al)) trovate.push(cat.id);
            }
          });
          setCategorieCalcolate(trovate);
        }
      }
    });
  }, [societaId, utente]);

  function toggleRuolo(ruolo) {
    setRuoliScelti(prev =>
      prev.includes(ruolo)
        ? prev.filter(r => r !== ruolo)
        : [...prev, ruolo]
    );
  }

  async function onSubmit(dati) {
    if (step === 1) {
      if (ruoliScelti.length === 0) {
        setErrore('Seleziona almeno un ruolo');
        return;
      }
      setErrore('');
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }

    // Step 3 — invio finale
    setCaricamento(true);
    setErrore('');

    try {
      const ip = await fetch('https://api.ipify.org?format=json')
        .then(r => r.json()).then(d => d.ip).catch(() => 'unknown');

      const versione = privacyPolicy?.versione || '1.0';

      // Registra consenso privacy. Se esiste già (tentativo precedente),
      // la regola Firestore blocca l'update: ignoriamo l'errore.
      const consensoRef = doc(db, 'consensiPrivacy', `${utente.uid}_${societaId}_${versione}`);
      try {
        await setDoc(consensoRef, {
          uid:         utente.uid,
          societaId,
          accettatoDa: utente.uid,
          versione,
          accettato:   true,
          timestamp:   serverTimestamp(),
          ip,
          userAgent:   navigator.userAgent,
          perConto:    false,
        });
      } catch (e) {
        if (e.code !== 'permission-denied') throw e;
        // documento già esistente — consenso già registrato, proseguiamo
      }

      // Se l'iscrizione esiste già (es. tentativo precedente parziale),
      // manda direttamente alla pagina di stato senza riscrivere
      const iscrizioneRef = doc(db, 'societa', societaId, 'iscrizioni', utente.uid);
      const iscrizioneSnap = await getDoc(iscrizioneRef);
      if (iscrizioneSnap.exists()) {
        navigate(`/stato-iscrizione/${societaId}`);
        return;
      }

      // Costruisce preferenzeNotifiche — proprie solo per atleti, perFigli solo per genitori
      const categorieIds = dati.tutteLeCategorie
        ? []
        : (dati.categorieIds || []).filter(Boolean);

      const preferenzeNotifiche = {};
      if (ruoliScelti.includes('atleta')) {
        preferenzeNotifiche.proprie = {
          tutteLeCategorie: dati.tutteLeCategorie,
          categorieIds,
          generale: true,
        };
      }
      if (ruoliScelti.includes('genitore')) {
        preferenzeNotifiche.perFigli = {
          tutteLeCategorie: true,
          categorieIds:     [],
          generale:         true,
        };
      }

      // Crea documento iscrizione
      await setDoc(iscrizioneRef, {
        uid:                utente.uid,
        ruoli:              ruoliScelti,
        statoAccount:       'in_attesa',
        annoIscrizione:     societa?.annoSchermistico || '',
        preferenzeNotifiche,
        categoriaCalcolata: ruoliScelti.includes('atleta') ? (categorieCalcolate[0] || null) : null,
        iscrittoAt:         serverTimestamp(),
        aggiornatoAt:       serverTimestamp(),
      });

      navigate(`/stato-iscrizione/${societaId}`);
    } catch (e) {
      console.error(e);
      setErrore('Errore durante l\'iscrizione. Riprova.');
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
                    px-4 py-8 overflow-y-auto">

      {/* Header */}
      <div className="mb-6 text-center">
        <div className="w-16 h-16 bg-scherma-navy rounded-2xl flex items-center
                        justify-center mx-auto mb-4 overflow-hidden">
          {societa.logoUrl ? (
            <img src={societa.logoUrl} alt={societa.nome}
                 className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-2xl font-bold">
              {societa.nome?.charAt(0)}
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-scherma-navy">{societa.nome}</h1>
        <p className="text-gray-500 text-sm mt-1">Richiesta di iscrizione alla bacheca</p>
      </div>

      {/* Indicatore step */}
      <div className="flex gap-2 mb-6">
        {[1,2,3].map(s => (
          <div key={s} className={`h-1.5 w-8 rounded-full transition-colors
            ${s <= step ? 'bg-scherma-blue' : 'bg-gray-200'}`} />
        ))}
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm
                      border border-gray-100 p-6">

        <form onSubmit={handleSubmit(onSubmit)}>

          {/* Step 1 — Scelta ruolo */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">
                  Come ti iscrivi?
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  Puoi selezionare entrambi se tiri di scherma e hai anche un figlio nel club.
                </p>

                <div className="rounded-xl overflow-hidden border border-gray-100">
                  <RuoloCard
                    ruolo="atleta"
                    titolo="Tiratore/Tiratrice"
                    descrizione="Ricevi avvisi sulla tua categoria"
                    selezionato={ruoliScelti.includes('atleta')}
                    onToggle={toggleRuolo}
                    icona="🤺"
                  />
                  <div className="h-px bg-gray-100 mx-4" />
                  <RuoloCard
                    ruolo="genitore"
                    titolo="Genitore"
                    descrizione="Segui gli avvisi per i tuoi figli"
                    selezionato={ruoliScelti.includes('genitore')}
                    onToggle={toggleRuolo}
                    icona="👨‍👧"
                  />
                </div>

                {errore && (
                  <p className="text-red-500 text-xs mt-3">{errore}</p>
                )}
              </div>

              <button type="submit"
                className="w-full bg-scherma-blue text-white py-3 rounded-xl
                           font-medium text-sm hover:bg-blue-700 transition-colors">
                Avanti
              </button>

              <button type="button" onClick={() => navigate('/scegli-societa')}
                className="w-full text-gray-400 text-sm py-2">
                Annulla
              </button>
            </div>
          )}

          {/* Step 2 — Preferenze notifiche (solo atleti) */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">
                  Preferenze notifiche
                </h2>
                <p className="text-xs text-gray-400 mb-4">
                  Scegli quali avvisi vuoi ricevere.
                </p>

                {ruoliScelti.includes('atleta') && (
                  <>
                    {categorieCalcolate.length > 0 && (
                      <div className="bg-blue-50 rounded-xl p-3 mb-4">
                        <p className="text-xs text-blue-700">
                          In base alla tua data di nascita, la tua categoria è{' '}
                          <strong>
                            {CATEGORIE_GRUPPI.find(c => c.id === categorieCalcolate[0])?.label}
                          </strong>
                        </p>
                      </div>
                    )}

                    <label className="flex items-center gap-3 mb-4 cursor-pointer">
                      <input type="checkbox"
                        className="w-5 h-5 rounded border-gray-300 text-scherma-blue"
                        {...register('tutteLeCategorie')}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Tutte le categorie
                        </p>
                        <p className="text-xs text-gray-400">
                          Ricevi tutti gli avvisi del club
                        </p>
                      </div>
                    </label>

                    {!tutteLeCategorie && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          Seleziona le categorie di interesse:
                        </p>
                        {CATEGORIE_GRUPPI.map(cat => (
                          <label key={cat.id}
                                 className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" value={cat.id}
                              defaultChecked={categorieCalcolate.includes(cat.id)}
                              className="w-4 h-4 rounded border-gray-300
                                         text-scherma-blue"
                              {...register('categorieIds')}
                            />
                            <span className="text-sm text-gray-700">
                              {cat.label}
                              {categorieCalcolate.includes(cat.id) && (
                                <span className="ml-1 text-xs text-blue-500">
                                  (tua categoria)
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {!ruoliScelti.includes('atleta') && ruoliScelti.includes('genitore') && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600">
                      Come genitore riceverai automaticamente gli avvisi
                      relativi alle categorie dei tuoi figli una volta
                      che li avrai aggiunti.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl border border-gray-200
                             text-sm font-medium text-gray-700">
                  Indietro
                </button>
                <button type="submit"
                  className="flex-1 bg-scherma-blue text-white py-3 rounded-xl
                             font-medium text-sm">
                  Avanti
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Privacy */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 mb-1">
                Consenso privacy
              </h2>

              <div className="bg-gray-50 rounded-xl p-4 max-h-48
                              overflow-y-auto text-xs text-gray-600 leading-relaxed">
                <p className="font-medium text-gray-800 mb-2">
                  Informativa privacy — {societa.nome} — v{privacyPolicy?.versione || '1.0'}
                </p>
                <p>
                  I tuoi dati personali vengono trattati da {societa.nome} per
                  inviarti avvisi e comunicazioni relative alle attività del club.
                  I dati non vengono ceduti a terzi.
                </p>
                <p className="mt-2">
                  Hai il diritto di accedere, rettificare o cancellare i tuoi
                  dati in qualsiasi momento contattando gli amministratori del club.
                </p>
                {privacyPolicy?.url && (
                  <a href={privacyPolicy.url} target="_blank" rel="noreferrer"
                     className="text-scherma-blue underline mt-2 block">
                    Leggi il testo completo
                  </a>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded border-gray-300
                             text-scherma-blue"
                  {...register('accettaPrivacy', {
                    required: 'Devi accettare per procedere'
                  })}
                />
                <span className="text-sm text-gray-700">
                  Accetto il trattamento dei miei dati personali da parte
                  di <strong>{societa.nome}</strong> come descritto nell'informativa
                  (v{privacyPolicy?.versione || '1.0'})
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
                <button type="button" onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl border border-gray-200
                             text-sm font-medium text-gray-700">
                  Indietro
                </button>
                <button type="submit" disabled={caricamento}
                  className="flex-1 bg-scherma-blue text-white py-3 rounded-xl
                             font-medium text-sm disabled:opacity-50">
                  {caricamento ? 'Invio...' : 'Invia richiesta'}
                </button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}

function RuoloCard({ ruolo, titolo, descrizione, selezionato, onToggle, icona }) {
  return (
    <button type="button" onClick={() => onToggle(ruolo)}
      className="w-full flex items-center gap-3 px-4 py-3 bg-white text-left">
      <span className="text-xl">{icona}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-800">{titolo}</p>
        <p className="text-xs text-gray-400 mt-0.5">{descrizione}</p>
      </div>
      {/* Toggle switch */}
      <div style={{
        width: 51, height: 31, borderRadius: 999, flexShrink: 0,
        backgroundColor: selezionato ? '#0179C0' : '#E5E7EB',
        position: 'relative',
        transition: 'background-color 0.2s',
      }}>
        <div style={{
          position: 'absolute',
          top: 2, left: selezionato ? 22 : 2,
          width: 27, height: 27,
          borderRadius: '50%',
          backgroundColor: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'left 0.2s',
        }} />
      </div>
    </button>
  );
}
