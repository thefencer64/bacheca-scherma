import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';

const STATI_LABEL = {
  attivo:          'Attivo',
  in_attesa:       'In attesa',
  attesa_consenso: 'Attesa consenso',
  attesa_admin:    'Attesa approvazione',
  da_rinnovare:    'Da rinnovare',
  decaduto:        'Decaduto',
  sospeso:         'Sospeso',
  pre_registrato:  'Pre-registrato',
};

const STATI_COLORI = {
  attivo:          'bg-green-100 text-green-700',
  in_attesa:       'bg-yellow-100 text-yellow-700',
  attesa_consenso: 'bg-blue-100 text-blue-700',
  attesa_admin:    'bg-orange-100 text-orange-700',
  da_rinnovare:    'bg-yellow-100 text-yellow-700',
  decaduto:        'bg-red-100 text-red-700',
  sospeso:         'bg-red-100 text-red-700',
  pre_registrato:  'bg-gray-100 text-gray-500',
};

function formatData(val) {
  if (!val) return null;
  // Firestore Timestamp serializzato dalla Cloud Function
  const d = val._seconds ? new Date(val._seconds * 1000)
          : val.toDate   ? val.toDate()
          : new Date(val);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminIscritti() {
  const { societaId }                   = useParams();
  const navigate                        = useNavigate();
  const [iscrizioni, setIscrizioni]     = useState([]);
  const [filtro, setFiltro]             = useState('tutti');
  const [caricamento, setCaricamento]   = useState(true);
  const [elaborazione, setElaborazione] = useState(null);

  const functions = getFunctions(undefined, 'europe-west1');

  const caricaIscritti = useCallback(async () => {
    setCaricamento(true);
    try {
      const fn      = httpsCallable(functions, 'getIscritti');
      const result  = await fn({ societaId });
      setIscrizioni(result.data.iscrizioni || []);
    } catch (e) {
      console.error('Errore caricamento iscritti:', e);
    } finally {
      setCaricamento(false);
    }
  }, [societaId]);

  useEffect(() => {
    caricaIscritti();
  }, [caricaIscritti]);

  async function approva(uid) {
    setElaborazione(uid);
    try {
      const fn = httpsCallable(functions, 'approvaIscrizione');
      await fn({ societaId, uid });
      await caricaIscritti();
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setElaborazione(null);
    }
  }

  async function rifiuta(uid) {
    const motivo = prompt('Motivo del rifiuto (opzionale):');
    if (motivo === null) return;
    setElaborazione(uid);
    try {
      const fn = httpsCallable(functions, 'rifiutaIscrizione');
      await fn({ societaId, uid, motivo });
      await caricaIscritti();
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setElaborazione(null);
    }
  }

  async function elimina(uid, nome) {
    if (!window.confirm(
      `Eliminare definitivamente l'iscrizione di ${nome}?\n\n` +
      `Se non ha iscrizioni in altre società, verrà eliminato anche l'account.`
    )) return;
    setElaborazione(uid);
    try {
      const fn = httpsCallable(functions, 'eliminaIscritto');
      const result = await fn({ societaId, uid });
      await caricaIscritti();
      if (result.data.accountEliminato) {
        alert(`Iscrizione e account di ${nome} eliminati.`);
      } else {
        alert(`Iscrizione di ${nome} eliminata. L'account è stato mantenuto perché iscritto ad altre società.`);
      }
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setElaborazione(null);
    }
  }

  const iscrizioniVisibili = iscrizioni
    .filter(i => i.statoAccount !== 'pre_registrato')
    .sort((a, b) => {
      const ca = `${a.anagrafica?.cognome || ''} ${a.anagrafica?.nome || ''}`.trim().toLowerCase();
      const cb = `${b.anagrafica?.cognome || ''} ${b.anagrafica?.nome || ''}`.trim().toLowerCase();
      return ca.localeCompare(cb, 'it');
    });

  const filtrate = filtro === 'tutti'
    ? iscrizioniVisibili
    : filtro === 'pendenti'
    ? iscrizioniVisibili.filter(i => ['in_attesa','attesa_admin','attesa_consenso'].includes(i.statoAccount))
    : iscrizioniVisibili.filter(i => i.statoAccount === filtro);

  const pendenti = iscrizioni.filter(i =>
    ['in_attesa','attesa_admin'].includes(i.statoAccount)
  ).length;

  return (
    <div className="">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Iscritti</h2>
        <div className="flex items-center gap-2">
          {pendenti > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {pendenti} da approvare
            </span>
          )}
          <button onClick={caricaIscritti}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11
                       11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {['tutti','pendenti','attivo','da_rinnovare','sospeso','decaduto'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium
                        whitespace-nowrap transition-colors
                        ${filtro === f
                          ? 'bg-scherma-navy text-white'
                          : 'bg-gray-100 text-gray-600'}`}>
            {f === 'tutti' ? 'Tutti' : f === 'pendenti' ? 'Da approvare' : STATI_LABEL[f]}
          </button>
        ))}
      </div>

      {caricamento ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-scherma-blue border-t-transparent
                          rounded-full animate-spin" />
        </div>
      ) : filtrate.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">Nessun iscritto</p>
      ) : (
        <div className="space-y-3">
          {filtrate.map(iscr => {
            const u = iscr.anagrafica || {};
            const daApprovare = ['in_attesa','attesa_admin'].includes(iscr.statoAccount);
            return (
              <div key={iscr.id}
                   className="bg-white rounded-2xl border border-gray-100 p-4"
                   style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-scherma-blue flex items-center
                                  justify-center text-white font-bold text-sm flex-shrink-0">
                    {u.nome?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {u.nome} {u.cognome}
                    </p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                    {formatData(iscr.ultimaVisita) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Ultima visita: {formatData(iscr.ultimaVisita)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1" style={{ maxWidth: "100%" }}>
                      <span className={`text-xs px-2 py-0.5 rounded-full
                                       ${STATI_COLORI[iscr.statoAccount]}`}>
                        {STATI_LABEL[iscr.statoAccount]}
                      </span>
                      {iscr.ruoli?.map(r => (
                        <span key={r} className="text-xs px-2 py-0.5 rounded-full
                                                  bg-gray-100 text-gray-600">
                          {r}
                        </span>
                      ))}
                      {iscr.categoriaCalcolata && iscr.ruoli?.includes('atleta') && (
                        <span className="text-xs px-2 py-0.5 rounded-full
                                         bg-blue-50 text-blue-600">
                          {iscr.categoriaCalcolata}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button onClick={() => navigate(`/${societaId}/admin/iscritti/${iscr.id}/modifica`)}
                    className="text-xs text-scherma-blue border border-blue-100
                               px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                    Modifica
                  </button>
                  {daApprovare && (
                    <>
                      <button onClick={() => approva(iscr.id)}
                        disabled={elaborazione === iscr.id}
                        className="flex-1 bg-green-500 text-white text-sm py-2
                                   rounded-xl font-medium disabled:opacity-50">
                        {elaborazione === iscr.id ? '...' : 'Approva'}
                      </button>
                      <button onClick={() => rifiuta(iscr.id)}
                        disabled={elaborazione === iscr.id}
                        className="flex-1 border border-red-200 text-red-500 text-sm
                                   py-2 rounded-xl font-medium disabled:opacity-50">
                        Rifiuta
                      </button>
                    </>
                  )}
                  {!daApprovare && (
                    <button onClick={() => elimina(iscr.id, `${u.nome} ${u.cognome}`)}
                      disabled={elaborazione === iscr.id}
                      className="ml-auto text-xs text-red-400 hover:text-red-600
                                 transition-colors px-3 py-1.5 rounded-lg
                                 border border-red-100 disabled:opacity-50">
                      {elaborazione === iscr.id ? '...' : 'Elimina'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
