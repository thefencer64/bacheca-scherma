import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

const STATI = ['attivo','in_attesa','attesa_consenso','attesa_admin',
               'da_rinnovare','decaduto','sospeso'];

const RUOLI_DISPONIBILI = ['atleta','genitore','admin'];

// Dato la categoria calcolata, restituisce le categorie a cui l'atleta può partecipare
function categorieAccessibili(categoriaCalcolata) {
  const mappa = {
    'minions':     ['minions', 'bambini'],
    'bambini':     ['bambini', 'giovanissimi'],
    'giovanissimi':['giovanissimi', 'ragazzi'],
    'ragazzi':     ['ragazzi'],
    'allievi':     ['allievi'],
    'cadetti':     ['cadetti', 'assoluti'],
    'giovani':     ['giovani', 'assoluti'],
    'under23':     ['under23', 'assoluti'],
    'assoluti':    ['assoluti'],
    'master_0':    ['assoluti', 'master_0'],
    'master_1':    ['assoluti', 'master_1'],
    'master_2':    ['assoluti', 'master_2'],
    'master_3':    ['assoluti', 'master_3'],
    'master_4':    ['assoluti', 'master_4'],
  };
  return mappa[categoriaCalcolata] || ['generale'];
}

const CATEGORIE = [
  { id: 'minions',     label: 'Minions' },
  { id: 'bambini',     label: 'Bambine/Maschietti' },
  { id: 'giovanissimi',label: 'Giovanissimi' },
  { id: 'ragazzi',     label: 'Ragazze/Ragazzi' },
  { id: 'allievi',     label: 'Allieve/Allievi' },
  { id: 'cadetti',     label: 'Cadetti' },
  { id: 'giovani',     label: 'Giovani' },
  { id: 'under23',     label: 'Under 23' },
  { id: 'assoluti',    label: 'Assoluti' },
  { id: 'master_0',    label: 'Master Cat.0 (over 24)' },
  { id: 'master_1',    label: 'Master Cat.1 (over 40)' },
  { id: 'master_2',    label: 'Master Cat.2 (over 50)' },
  { id: 'master_3',    label: 'Master Cat.3 (over 60)' },
  { id: 'master_4',    label: 'Master Cat.4 (over 70)' },
  { id: 'paralimpico', label: 'Paralimpico' },
  { id: 'integrata',   label: 'Scherma Integrata' },
  { id: 'non_vedenti', label: 'Non Vedenti' },
];

export default function ModificaIscritto() {
  const { societaId, uid } = useParams();
  const navigate           = useNavigate();
  const { utente }         = useAuth();

  const [iscrizione, setIscrizione]   = useState(null);
  const [anagrafica, setAnagrafica]   = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [salvando, setSalvando]       = useState(false);
  const [errore, setErrore]           = useState('');
  const [successo, setSuccesso]       = useState(false);

  // Stato locale per i checkbox dei figli (evita problemi con rendering condizionale)
  const [tutteFigli, setTutteFigli]   = useState(true);
  const [catsFigli, setCatsFigli]     = useState([]);
  const [figli, setFigli]             = useState([]); // { figlioUid, nome, cognome, relId }
  const [eliminandoFiglio, setEliminandoFiglio] = useState(null);

  const { register, handleSubmit, setValue, watch } = useForm();
  const categoriaCalcolataWatch = watch('categoriaCalcolata');
  const ruoliSelezionati = watch('ruoli') || [];

  useEffect(() => {
    if (!societaId || !uid || !utente) return;

    // Guard: verifica che l'utente corrente sia admin in questa società
    getDoc(doc(db, 'societa', societaId, 'iscrizioni', utente.uid)).then(miaIscr => {
      if (!miaIscr.exists() || !miaIscr.data().ruoli?.includes('admin')) {
        navigate(`/${societaId}/admin`);
      }
    });

    Promise.all([
      getDoc(doc(db, 'societa', societaId, 'iscrizioni', uid)),
      getDoc(doc(db, 'utenti', uid)),
    ]).then(([iscr, uSnap]) => {
      if (iscr.exists()) {
        const d = iscr.data();
        setIscrizione(d);
        setValue('statoAccount',      d.statoAccount || 'attivo');
        setValue('ruoli',             d.ruoli || []);
        setValue('categoriaCalcolata',d.categoriaCalcolata || '');
        setValue('annoIscrizione',    d.annoIscrizione || '');

        const prefNotifiche = d.preferenzeNotifiche || {};

        // Preferenze proprie (atleta)
        const pref = prefNotifiche.proprie || (d.ruoli?.includes('atleta') ? prefNotifiche : {});
        const tutteLeCategorie = pref?.tutteLeCategorie ?? false;
        setValue('tutteLeCategorie', tutteLeCategorie);
        const cats = (pref?.categorieIds && pref.categorieIds.length > 0)
          ? pref.categorieIds
          : categorieAccessibili(d.categoriaCalcolata || '');
        setValue('categoriePreferite', cats);

        // Preferenze perFigli (genitore) — stato locale per evitare problemi checkbox
        const prefFigli = prefNotifiche.perFigli || {};
        setTutteFigli(prefFigli.tutteLeCategorie ?? true);
        setCatsFigli(prefFigli.categorieIds || []);
      }
      if (uSnap.exists()) {
        setAnagrafica(uSnap.data());
        const a = uSnap.data();
        setValue('nome',        a.nome || '');
        setValue('cognome',     a.cognome || '');
        setValue('dataNascita', a.dataNascita || '');
        setValue('telefono',    a.telefono || '');
      }
      setCaricamento(false);
    });

    // Carica figli del genitore
    getDocs(query(
      collection(db, 'societa', societaId, 'relazioni'),
      where('genitoreUid', '==', uid)
    )).then(async relazioniSnap => {
      const risultati = await Promise.all(
        relazioniSnap.docs.map(async relDoc => {
          const { figlioUid } = relDoc.data();
          const uSnap = await getDoc(doc(db, 'utenti', figlioUid));
          const u = uSnap.exists() ? uSnap.data() : {};
          return { figlioUid, relId: relDoc.id, nome: u.nome || '', cognome: u.cognome || '' };
        })
      );
      setFigli(risultati);
    }).catch(() => {});
  }, [societaId, uid]);

  async function onSubmit(dati) {
    setSalvando(true);
    setErrore('');
    try {
      const ruoli = Array.isArray(dati.ruoli) ? dati.ruoli : [dati.ruoli].filter(Boolean);
      const tutteLeCategorie = dati.tutteLeCategorie === true || dati.tutteLeCategorie === 'true';
      
      // Normalizza categoriePreferite sempre ad array non-null
      let categorieIds = [];
      if (!tutteLeCategorie) {
        const raw = dati.categoriePreferite;
        if (Array.isArray(raw)) {
          categorieIds = raw.filter(Boolean);
        } else if (raw) {
          categorieIds = [raw];
        }
      }

      const preferenzeNotifiche = {};
      if (ruoli.includes('atleta')) {
        preferenzeNotifiche.proprie = { tutteLeCategorie, categorieIds, generale: true };
      }
      if (ruoli.includes('genitore')) {
        preferenzeNotifiche.perFigli = {
          tutteLeCategorie: tutteFigli,
          categorieIds:     tutteFigli ? [] : catsFigli,
          generale:         true,
        };
      }

      const functions = getFunctions(undefined, 'europe-west1');
      const fn = httpsCallable(functions, 'modificaIscritto');
      await fn({
        societaId,
        uid,
        anagrafica: {
          nome:        dati.nome,
          cognome:     dati.cognome,
          dataNascita: dati.dataNascita,
          telefono:    dati.telefono || '',
        },
        iscrizione: {
          statoAccount:       dati.statoAccount,
          ruoli,
          categoriaCalcolata: ruoli.includes('atleta') ? (dati.categoriaCalcolata || null) : null,
          annoIscrizione:     dati.annoIscrizione || '',
          preferenzeNotifiche,
        },
      });

      setSuccesso(true);
      setTimeout(() => navigate(`/${societaId}/admin/iscritti`), 1500);
    } catch(e) {
      setErrore('Errore durante il salvataggio: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function eliminaFiglio(figlio) {
    if (!window.confirm(
      `Eliminare definitivamente ${figlio.nome} ${figlio.cognome}?\n\n` +
      `Se non ha iscrizioni in altre società, verrà eliminato anche l'account.`
    )) return;
    setEliminandoFiglio(figlio.figlioUid);
    try {
      const functions = getFunctions(undefined, 'europe-west1');
      await httpsCallable(functions, 'eliminaIscritto')({ societaId, uid: figlio.figlioUid });
      setFigli(prev => prev.filter(f => f.figlioUid !== figlio.figlioUid));
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setEliminandoFiglio(null);
    }
  }

  if (caricamento) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-scherma-blue border-t-transparent
                      rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24"
               stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Modifica iscritto</h2>
          <p className="text-xs text-gray-400">{anagrafica?.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Dati anagrafici */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Dati anagrafici
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
              <input type="text"
                className="w-full px-3 py-2 rounded-xl border border-gray-200
                           focus:outline-none focus:ring-2 focus:ring-scherma-blue"
                style={{ fontSize: '16px' }}
                {...register('nome', { required: true })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cognome</label>
              <input type="text"
                className="w-full px-3 py-2 rounded-xl border border-gray-200
                           focus:outline-none focus:ring-2 focus:ring-scherma-blue"
                style={{ fontSize: '16px' }}
                {...register('cognome', { required: true })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Data di nascita
            </label>
            <input type="date"
              className="w-full px-3 py-2 rounded-xl border border-gray-200
                         focus:outline-none focus:ring-2 focus:ring-scherma-blue"
              style={{ fontSize: '16px' }}
              {...register('dataNascita')}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Telefono</label>
            <input type="tel"
              className="w-full px-3 py-2 rounded-xl border border-gray-200
                         focus:outline-none focus:ring-2 focus:ring-scherma-blue"
              style={{ fontSize: '16px' }}
              {...register('telefono')}
            />
          </div>
        </div>

        {/* Dati iscrizione */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Iscrizione
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Stato account
            </label>
            <select
              className="w-full px-3 py-2 rounded-xl border border-gray-200
                         focus:outline-none focus:ring-2 focus:ring-scherma-blue bg-white"
              style={{ fontSize: '16px' }}
              {...register('statoAccount')}
            >
              {STATI.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Ruoli</label>
            <div className="flex flex-wrap gap-2">
              {RUOLI_DISPONIBILI.map(ruolo => (
                <label key={ruolo} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" value={ruolo}
                    className="w-4 h-4 rounded border-gray-300 text-scherma-blue"
                    {...register('ruoli')}
                  />
                  <span className="text-sm text-gray-700">{ruolo}</span>
                </label>
              ))}
            </div>
          </div>

          {ruoliSelezionati.includes('genitore') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">
                  Categorie figli (notifiche)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-scherma-blue"
                    checked={tutteFigli}
                    onChange={e => setTutteFigli(e.target.checked)}
                  />
                  <span className="text-xs text-gray-600">Tutte</span>
                </label>
              </div>
              {!tutteFigli && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {CATEGORIE.map(c => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-scherma-blue"
                        checked={catsFigli.includes(c.id)}
                        onChange={e => setCatsFigli(prev =>
                          e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id)
                        )}
                      />
                      <span className="text-sm text-gray-700">{c.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {ruoliSelezionati.includes('atleta') && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Categoria FIS (calcolata dall'età)
                </label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-gray-200
                             focus:outline-none focus:ring-2 focus:ring-scherma-blue text-sm
                             bg-white"
                  {...register('categoriaCalcolata')}
                >
                  <option value="">— Nessuna categoria —</option>
                  {CATEGORIE.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">
                    Preferenze notifiche
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-scherma-blue"
                      {...register('tutteLeCategorie')}
                    />
                    <span className="text-xs text-gray-600">Tutte le categorie</span>
                  </label>
                </div>
                {watch('tutteLeCategorie') !== true && watch('tutteLeCategorie') !== 'true' && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {CATEGORIE.map(c => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" value={c.id}
                          className="w-4 h-4 rounded border-gray-300 text-scherma-blue"
                          {...register('categoriePreferite')}
                        />
                        <span className="text-sm text-gray-700">{c.label}</span>
                        {watch('categoriaCalcolata') === c.id && (
                          <span className="text-xs text-blue-500 ml-1">(tua categoria)</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Anno iscrizione
            </label>
            <input type="text" placeholder="es. 2025-2026"
              className="w-full px-3 py-2 rounded-xl border border-gray-200
                         focus:outline-none focus:ring-2 focus:ring-scherma-blue"
              style={{ fontSize: '16px' }}
              {...register('annoIscrizione')}
            />
          </div>
        </div>

        {/* Figli collegati */}
        {figli.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Figli collegati
            </p>
            {figli.map(f => (
              <div key={f.figlioUid}
                   className="flex items-center justify-between gap-3 py-1">
                <span className="text-sm text-gray-800">
                  {f.nome} {f.cognome}
                </span>
                <button type="button"
                  onClick={() => eliminaFiglio(f)}
                  disabled={eliminandoFiglio === f.figlioUid}
                  className="text-xs text-red-400 hover:text-red-600 border border-red-100
                             px-3 py-1 rounded-lg transition-colors disabled:opacity-50">
                  {eliminandoFiglio === f.figlioUid ? '...' : 'Elimina'}
                </button>
              </div>
            ))}
          </div>
        )}

        {errore && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm">{errore}</p>
          </div>
        )}

        {successo && (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <p className="text-green-700 text-sm">✓ Salvato con successo!</p>
          </div>
        )}

        <button type="submit" disabled={salvando}
          className="w-full bg-scherma-blue text-white py-4 rounded-2xl
                     font-semibold text-sm hover:bg-blue-700 transition-colors
                     disabled:opacity-50">
          {salvando ? 'Salvataggio...' : 'Salva modifiche'}
        </button>

      </form>
    </div>
  );
}
