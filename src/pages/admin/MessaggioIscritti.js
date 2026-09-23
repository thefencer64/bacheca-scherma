import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';

const STATI_VALIDI = ['attivo', 'da_rinnovare', 'sospeso'];

export default function MessaggioIscritti() {
  const { societaId } = useParams();
  const navigate      = useNavigate();

  const [iscrizioni, setIscrizioni]   = useState([]);
  const [selezionati, setSelezionati] = useState(new Set());
  const [oggetto, setOggetto]         = useState('');
  const [testo, setTesto]             = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [invio, setInvio]             = useState(false);
  const [esito, setEsito]             = useState(null);

  const functions = getFunctions(undefined, 'europe-west1');

  const caricaIscritti = useCallback(async () => {
    setCaricamento(true);
    try {
      const fn     = httpsCallable(functions, 'getIscritti');
      const result = await fn({ societaId });
      const lista  = (result.data.iscrizioni || [])
        .filter(i => STATI_VALIDI.includes(i.statoAccount))
        .sort((a, b) => {
          const na = `${a.anagrafica?.cognome} ${a.anagrafica?.nome}`;
          const nb = `${b.anagrafica?.cognome} ${b.anagrafica?.nome}`;
          return na.localeCompare(nb, 'it');
        });
      setIscrizioni(lista);
    } catch (e) {
      console.error(e);
    } finally {
      setCaricamento(false);
    }
  }, [societaId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { caricaIscritti(); }, [caricaIscritti]);

  function toggleSelezionato(uid) {
    setSelezionati(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }

  function selezionaTutti() {
    setSelezionati(new Set(iscrizioni.map(i => i.id)));
  }

  function deselezionaTutti() {
    setSelezionati(new Set());
  }

  async function invia() {
    if (selezionati.size === 0) { alert('Seleziona almeno un destinatario.'); return; }
    if (!oggetto.trim())        { alert("Inserisci l'oggetto del messaggio."); return; }
    if (!testo.trim())          { alert('Inserisci il testo del messaggio.'); return; }

    setInvio(true);
    setEsito(null);
    try {
      const fn     = httpsCallable(functions, 'inviaMessaggioIscritti');
      const result = await fn({
        societaId,
        uids:    [...selezionati],
        oggetto: oggetto.trim(),
        testo:   testo.trim(),
      });
      setEsito(`Messaggio inviato a ${result.data.inviati} destinatar${result.data.inviati === 1 ? 'io' : 'i'}.`);
      setSelezionati(new Set());
      setOggetto('');
      setTesto('');
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setInvio(false);
    }
  }

  const tutti = iscrizioni.length > 0 && selezionati.size === iscrizioni.length;

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24"
               stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-gray-900">Messaggio ad iscritti</h2>
      </div>

      {esito && (
        <div className="mb-4 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <p className="text-sm text-green-700">{esito}</p>
        </div>
      )}

      {/* Destinatari */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">
            Destinatari
            {selezionati.size > 0 && (
              <span className="ml-1 text-scherma-blue">({selezionati.size})</span>
            )}
          </p>
          <button onClick={tutti ? deselezionaTutti : selezionaTutti}
            className="text-xs text-scherma-blue font-medium">
            {tutti ? 'Deseleziona tutti' : 'Seleziona tutti'}
          </button>
        </div>

        {caricamento ? (
          <div className="flex justify-center py-8">
            <div className="w-7 h-7 border-4 border-scherma-blue border-t-transparent
                            rounded-full animate-spin" />
          </div>
        ) : iscrizioni.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">Nessun iscritto</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto overflow-x-hidden">
            {iscrizioni.map(iscr => {
              const u   = iscr.anagrafica || {};
              const sel = selezionati.has(iscr.id);
              return (
                <label key={iscr.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer
                              transition-colors select-none
                              ${sel
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-white border-gray-100'}`}>
                  <input type="checkbox" checked={sel}
                    onChange={() => toggleSelezionato(iscr.id)}
                    className="w-4 h-4 rounded border-gray-300 text-scherma-blue
                               focus:ring-scherma-blue flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {u.cognome} {u.nome}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {iscr.ruoli?.join(', ')}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Messaggio */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Oggetto *
          </label>
          <input type="text" value={oggetto}
            onChange={e => setOggetto(e.target.value)}
            placeholder="Oggetto del messaggio"
            className="w-full px-4 py-3 rounded-xl border border-gray-200
                       focus:outline-none focus:ring-2 focus:ring-scherma-blue"
            style={{ fontSize: '16px' }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Testo *
          </label>
          <textarea rows={6} value={testo}
            onChange={e => setTesto(e.target.value)}
            placeholder="Scrivi qui il testo del messaggio..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200
                       focus:outline-none focus:ring-2 focus:ring-scherma-blue resize-none"
            style={{ fontSize: '16px' }}
          />
        </div>
      </div>

      <button onClick={invia} disabled={invio || caricamento}
        className="mt-5 w-full bg-scherma-blue text-white py-4 rounded-2xl
                   font-semibold text-sm hover:bg-blue-700 transition-colors
                   disabled:opacity-50">
        {invio
          ? 'Invio in corso...'
          : selezionati.size > 0
            ? `Invia a ${selezionati.size} destinatar${selezionati.size === 1 ? 'io' : 'i'}`
            : 'Invia messaggio'}
      </button>
    </div>
  );
}
