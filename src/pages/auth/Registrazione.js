import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

export default function Registrazione() {
  const { registraConEmail } = useAuth();
  const navigate = useNavigate();
  const [errore, setErrore]           = useState('');
  const [caricamento, setCaricamento] = useState(false);
  const [step, setStep]               = useState(1); // 1=anagrafica, 2=privacy
  const [mostraBypass, setMostraBypass] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  useEffect(() => {
    // Carica versione privacy policy corrente
    getDoc(doc(db, 'configPrivacy', 'corrente')).then(snap => {
      if (snap.exists()) setPrivacyPolicy(snap.data());
    });
  }, []);

  async function onSubmit(dati) {
    if (step === 1) {
      // Blocca i minorenni
      const oggi = new Date();
      const nascita = new Date(dati.dataNascita);
      const eta = oggi.getFullYear() - nascita.getFullYear() -
        (oggi < new Date(oggi.getFullYear(), nascita.getMonth(), nascita.getDate()) ? 1 : 0);
      if (eta < 18) {
        setErrore('I minorenni non possono registrarsi autonomamente. Chiedi a un genitore o tutore di aggiungerti dal proprio profilo.');
        setMostraBypass(true);
        return;
      }

      setMostraBypass(false);
      setStep(2);
      return;
    }

    setErrore('');
    setCaricamento(true);
    try {
      const user = await registraConEmail(dati.email, dati.password, {
        nome:        dati.nome,
        cognome:     dati.cognome,
        dataNascita: dati.dataNascita,
        telefono:    dati.telefono,
      });

      // Log consenso privacy (senza societaId per ora — verrà aggiunto all'iscrizione)
      // Il consenso specifico per società verrà registrato al momento dell'iscrizione
      window.location.href = '/';
    } catch (e) {
      setErrore(traduciErrore(e.code));
      setStep(1);
    } finally {
      setCaricamento(false);
    }
  }

  async function completaRegistrazione(dati, salvaPrivacy) {
    setErrore('');
    setCaricamento(true);
    try {
      await registraConEmail(dati.email, dati.password, {
        nome:        dati.nome,
        cognome:     dati.cognome,
        dataNascita: dati.dataNascita,
        telefono:    dati.telefono,
      });
      window.location.href = '/';
    } catch (e) {
      setErrore(traduciErrore(e.code));
      setStep(1);
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center
                    px-4 py-8 overflow-y-auto"
         style={{ paddingTop: "max(2rem, env(safe-area-inset-top))", paddingBottom: "2rem" }}>
      <div className="mb-6 text-center">
                  <img src="https://firebasestorage.googleapis.com/v0/b/fcbachecascherma.firebasestorage.app/o/bacheca_scherma_icon.png?alt=media&token=1e294cb8-eb47-468b-a302-b71de444ec63" alt="Bacheca Scherma" className="w-16 h-16 rounded-2xl mx-auto mb-4" style={{objectFit: "cover"}} />
        <h1 className="text-2xl font-bold text-scherma-navy">Crea account</h1>
        <p className="text-gray-500 text-sm mt-1">
          {step === 1 ? 'I tuoi dati personali' : 'Privacy e consensi'}
        </p>
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
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
                  {errors.nome && <p className="text-red-500 text-xs mt-1">{errors.nome.message}</p>}
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
                  {errors.cognome && <p className="text-red-500 text-xs mt-1">{errors.cognome.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data di nascita
                </label>
                <input type="date"
                  className="w-full px-3 py-3 rounded-xl border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-scherma-blue
                             text-sm"
                  {...register('dataNascita', { required: 'Obbligatoria' })}
                />
                {errors.dataNascita && <p className="text-red-500 text-xs mt-1">{errors.dataNascita.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefono
                </label>
                <input type="tel"
                  className="w-full px-3 py-3 rounded-xl border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-scherma-blue
                             text-sm"
                  placeholder="+39 333 1234567"
                  {...register('telefono')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input type="email" autoComplete="email"
                  className="w-full px-3 py-3 rounded-xl border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-scherma-blue
                             text-sm"
                  {...register('email', {
                    required: 'Obbligatoria',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Email non valida' }
                  })}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input type="password" autoComplete="new-password"
                  className="w-full px-3 py-3 rounded-xl border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-scherma-blue
                             text-sm"
                  placeholder="Almeno 8 caratteri"
                  {...register('password', {
                    required: 'Obbligatoria',
                    minLength: { value: 8, message: 'Minimo 8 caratteri' }
                  })}
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="bg-gray-50 rounded-xl p-4 max-h-48 overflow-y-auto
                              text-xs text-gray-600 leading-relaxed">
                <p className="font-medium text-gray-800 mb-2">
                  Informativa sulla privacy — v{privacyPolicy?.versione || '1.0'}
                </p>
                <p>
                  I tuoi dati personali (nome, cognome, data di nascita, email, telefono)
                  vengono raccolti per permetterti di ricevere avvisi e comunicazioni
                  dalle società di scherma a cui sei iscritto.
                </p>
                <p className="mt-2">
                  I dati non vengono ceduti a terzi e vengono conservati per la durata
                  dell'iscrizione più 5 anni. Hai il diritto di accedere, rettificare
                  o cancellare i tuoi dati in qualsiasi momento.
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
                             text-scherma-blue focus:ring-scherma-blue"
                  {...register('accettaPrivacy', {
                    required: 'Devi accettare la privacy policy per continuare'
                  })}
                />
                <span className="text-sm text-gray-700">
                  Ho letto e accetto la{' '}
                  <span className="font-medium">Privacy Policy</span>
                  {' '}(v{privacyPolicy?.versione || '1.0'})
                </span>
              </label>
              {errors.accettaPrivacy && (
                <p className="text-red-500 text-xs">{errors.accettaPrivacy.message}</p>
              )}
            </>
          )}

          {errore && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{errore}</p>
              {mostraBypass && step === 1 && (
                <button
                  type="button"
                  onClick={() => { setMostraBypass(false); setErrore(''); completaRegistrazione(watch()); }}
                  className="mt-3 w-full bg-scherma-blue text-white text-sm py-2 rounded-lg font-medium">
                  Sei già stato pre-registrato da un genitore? Continua →
                </button>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {step === 2 && (
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl border border-gray-200
                           text-sm font-medium text-gray-700 hover:bg-gray-50">
                Indietro
              </button>
            )}
            <button type="submit" disabled={caricamento}
              className="flex-1 bg-scherma-blue text-white py-3 rounded-xl
                         font-medium text-sm hover:bg-blue-700 transition-colors
                         disabled:opacity-50">
              {caricamento ? 'Creazione...' : step === 1 ? 'Avanti' : 'Crea account'}
            </button>
          </div>

        </form>

        {step === 1 && (
          <p className="text-center text-sm text-gray-500 mt-5">
            Hai già un account?{' '}
            <Link to="/login" className="text-scherma-blue font-medium">Accedi</Link>
          </p>
        )}
      </div>
    </div>
  );
}

function traduciErrore(code) {
  const errori = {
    'auth/email-already-in-use': 'Email già in uso. Prova ad accedere.',
    'auth/weak-password':        'Password troppo debole.',
    'auth/network-request-failed': 'Errore di rete. Controlla la connessione.',
  };
  return errori[code] || 'Si è verificato un errore. Riprova.';
}
