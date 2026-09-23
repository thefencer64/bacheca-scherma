import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

export default function Profilo() {
  const { utente, profilo, logout } = useAuth();
  const { societaId }               = useParams();
  const navigate                    = useNavigate();
  const [iscrizione, setIscrizione]   = useState(null);
  const [figli, setFigli]             = useState([]);
  const [societa, setSocieta]         = useState(null);
  const [erroreCaricamento, setErroreCaricamento] = useState(false);

  useEffect(() => {
    if (!utente || !societaId) return;

    // Carica dati società
    getDoc(doc(db, 'societa', societaId)).then(snap => {
      if (snap.exists()) setSocieta(snap.data());
    });

    // Carica iscrizione corrente, poi i figli
    getDoc(doc(db, 'societa', societaId, 'iscrizioni', utente.uid))
      .then(snap => {
        if (snap.exists()) {
          setIscrizione(snap.data());
          return getDocs(query(
            collection(db, 'societa', societaId, 'relazioni'),
            where('genitoreUid', '==', utente.uid)
          ));
        }
      })
      .then(async snap => {
        if (!snap) return;
        const lista = await Promise.all(
          snap.docs.map(async relDoc => {
            const rel   = relDoc.data();
            let uSnap, iSnap;
            try {
              uSnap = await getDoc(doc(db, 'utenti', rel.figlioUid));
            } catch(e) {
              console.error('Errore lettura utente figlio:', e.code);
            }
            try {
              iSnap = await getDoc(
                doc(db, 'societa', societaId, 'iscrizioni', rel.figlioUid)
              );
            } catch(e) {
              console.error('Errore lettura iscrizione figlio:', e.code);
            }
            return {
              ...rel,
              anagrafica: uSnap?.exists() ? uSnap.data() : null,
              iscrizione: iSnap?.exists() ? iSnap.data() : null,
            };
          })
        );
        setFigli(lista);
      })
      .catch(e => {
        console.error('Errore profilo:', e.code, e.message);
        setErroreCaricamento(true);
      });
  }, [utente, societaId]);

  async function handleLogout() {
    await logout();
  }

  const isGenitore = iscrizione?.ruoli?.includes('genitore');

  function formataData(dataNascita) {
    if (!dataNascita) return '—';
    // Formato ISO: "1964-08-27" → "27/08/1964"
    return dataNascita.split('-').reverse().join('/');
  }

  const STATI_LABEL = {
    attivo:          'Attivo',
    in_attesa:       'In attesa',
    attesa_consenso: 'Attesa consenso',
    attesa_admin:    'Attesa approvazione',
    da_rinnovare:    'Da rinnovare',
    decaduto:        'Decaduto',
    sospeso:         'Sospeso',
  };

  const CATEGORIE_LABEL = {
    minions:     'Minions',
    generale:    'Generale',
    bambini:     'Bambine/Maschietti',
    giovanissimi:'Giovanissimi',
    ragazzi:     'Ragazze/Ragazzi',
    allievi:     'Allieve/Allievi',
    cadetti:     'Cadetti',
    giovani:     'Giovani',
    under23:     'Under 23',
    assoluti:    'Assoluti',
    master_0:    'Master Cat.0',
    master_1:    'Master Cat.1',
    master_2:    'Master Cat.2',
    master_3:    'Master Cat.3',
    master_4:    'Master Cat.4',
    paralimpico: 'Paralimpico',
    integrata:   'Scherma Integrata',
    non_vedenti: 'Non Vedenti',
  };

  return (
    <div className="space-y-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>

      {/* Dati personali */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-scherma-blue flex items-center
                          justify-center text-white text-xl font-bold flex-shrink-0">
            {profilo?.nome?.charAt(0) || utente?.email?.charAt(0) || '?'}
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {profilo ? `${profilo.nome} ${profilo.cognome}` : 'Utente'}
            </p>
            <p className="text-sm text-gray-500">{utente?.email}</p>
            {iscrizione && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {iscrizione.ruoli?.map(r => (
                  <span key={r} className="text-xs bg-gray-100 text-gray-600
                                            px-2 py-0.5 rounded-full">
                    {r}
                  </span>
                ))}
                {iscrizione.categoriaCalcolata && (
                  <span className="text-xs bg-blue-100 text-blue-700
                                   px-2 py-0.5 rounded-full">
                    {CATEGORIE_LABEL[iscrizione.categoriaCalcolata] || iscrizione.categoriaCalcolata}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm border-t border-gray-50 pt-3">
          {profilo?.dataNascita && (
            <div className="flex justify-between">
              <span className="text-gray-400">Data di nascita</span>
              <span className="text-gray-700">{formataData(profilo.dataNascita)}</span>
            </div>
          )}
          {profilo?.telefono && (
            <div className="flex justify-between">
              <span className="text-gray-400">Telefono</span>
              <span className="text-gray-700">{profilo.telefono}</span>
            </div>
          )}
        </div>
      </div>

      {erroreCaricamento && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <p className="text-red-600 text-sm">
            Errore nel caricamento dei dati. Controlla la connessione e ricarica la pagina.
          </p>
        </div>
      )}

      {/* Sezione figli (solo se genitore) */}
      {isGenitore && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4
                          border-b border-gray-100">
            <p className="font-semibold text-gray-900 text-sm">I tuoi figli</p>
            <button
              onClick={() => navigate(`/${societaId}/aggiungi-figlio`)}
              className="text-xs text-scherma-blue font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 4v16m8-8H4" />
              </svg>
              Aggiungi
            </button>
          </div>

          {figli.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-gray-400">Nessun figlio ancora aggiunto</p>
              <button
                onClick={() => navigate(`/${societaId}/aggiungi-figlio`)}
                className="mt-2 text-sm text-scherma-blue font-medium">
                Aggiungi il primo figlio
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {figli.map((f, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-scherma-navy flex items-center
                                  justify-center text-white text-sm font-bold flex-shrink-0">
                    {f.anagrafica?.nome?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {f.anagrafica?.nome} {f.anagrafica?.cognome}
                    </p>
                    <p className="text-xs text-gray-400">
                      {CATEGORIE_LABEL[f.iscrizione?.categoriaCalcolata] || f.iscrizione?.categoriaCalcolata || 'Categoria non calcolata'}
                      {' · '}
                      {STATI_LABEL[f.iscrizione?.statoAccount] || f.iscrizione?.statoAccount}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Link privacy */}
      {societa && (() => {
        const params = new URLSearchParams({
          societa:  societa.nome || '',
          indirizzo: societa.indirizzo || societa.citta || '',
          cf:       societa.codiceFiscale || '',
          email:    societa.emailNotifiche || '',
          versione: '1.0',
          data:     '07/04/2026',
        });
        return (
          <a href={`https://bachecascherma.it/privacy.html?${params.toString()}`}
            target="_blank" rel="noopener noreferrer"
            className="block text-center text-xs text-gray-400 hover:text-gray-600
                       transition-colors py-2">
            Privacy Policy
          </a>
        );
      })()}

      {/* Azioni account */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-5 py-4
                     hover:bg-gray-50 transition-colors">
          <span className="text-sm text-red-500">Esci dall'account</span>
          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24"
               stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0
                     01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
