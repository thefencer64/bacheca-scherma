import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

export default function SceltaSocieta() {
  const { utente, profilo, logout } = useAuth();
  const navigate = useNavigate();
  const [societa, setSocieta]         = useState([]);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    if (!utente) return;

    // Controlla se il profilo è completo (data di nascita obbligatoria)
    if (profilo && !profilo.dataNascita) {
      navigate('/completa-profilo');
      return;
    }

    // Aspetta che il profilo sia caricato prima di procedere
    if (profilo !== null) {
      caricaSocieta();
    }
  }, [utente, profilo]);

  async function caricaSocieta() {
    setCaricamento(true);
    try {
      const tutteSnap = await getDocs(collection(db, 'societa'));
      const tutte = tutteSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const conStato = await Promise.all(tutte.map(async s => {
        const iscr = await getDoc(
          doc(db, 'societa', s.id, 'iscrizioni', utente.uid)
        );
        return {
          ...s,
          iscrizione: iscr.exists() ? iscr.data() : null,
        };
      }));

      // Ordina: prima le società dove sei iscritto e attivo
      conStato.sort((a, b) => {
        const pesoA = a.iscrizione?.statoAccount === 'attivo' ? 0 : 1;
        const pesoB = b.iscrizione?.statoAccount === 'attivo' ? 0 : 1;
        return pesoA - pesoB;
      });

      setSocieta(conStato);
    } catch (e) {
      console.error('Errore caricamento società:', e);
    } finally {
      setCaricamento(false);
    }
  }

  function apriSocieta(societaId, iscrizione) {
    if (!iscrizione) {
      navigate(`/iscriviti/${societaId}`);
      return;
    }
    if (iscrizione.statoAccount === 'attivo') {
      if (iscrizione.ruoli?.includes('admin')) {
        navigate(`/${societaId}/admin`);
      } else {
        navigate(`/${societaId}`);
      }
      return;
    }
    navigate(`/stato-iscrizione/${societaId}`);
  }

  function badgeStato(iscrizione) {
    if (!iscrizione) return (
      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
        Non iscritto
      </span>
    );
    const colori = {
      attivo:          'bg-green-100 text-green-700',
      in_attesa:       'bg-yellow-100 text-yellow-700',
      attesa_consenso: 'bg-blue-100 text-blue-700',
      attesa_admin:    'bg-orange-100 text-orange-700',
      da_rinnovare:    'bg-yellow-100 text-yellow-700',
      decaduto:        'bg-red-100 text-red-700',
      sospeso:         'bg-red-100 text-red-700',
    };
    const etichette = {
      attivo:          'Attivo',
      in_attesa:       'In attesa di approvazione',
      attesa_consenso: 'In attesa di consenso',
      attesa_admin:    'In attesa di approvazione',
      da_rinnovare:    'Rinnovo richiesto',
      decaduto:        'Iscrizione decaduta',
      sospeso:         'Account sospeso',
    };
    const stato = iscrizione.statoAccount;
    return (
      <span className={`text-xs px-2 py-1 rounded-full
                       ${colori[stato] || 'bg-gray-100 text-gray-500'}`}>
        {etichette[stato] || stato}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-8 overflow-y-auto"
         style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
      <div className="max-w-sm mx-auto w-full">

        <div className="mb-8 text-center">
                    <img src="https://firebasestorage.googleapis.com/v0/b/fcbachecascherma.firebasestorage.app/o/bacheca_scherma_icon.png?alt=media&token=1e294cb8-eb47-468b-a302-b71de444ec63" alt="Bacheca Scherma" className="w-16 h-16 rounded-2xl mx-auto mb-4" style={{objectFit: "cover"}} />
          <h1 className="text-xl font-bold text-scherma-navy">Scegli la bacheca</h1>
          <p className="text-gray-500 text-sm mt-1">
            Seleziona la società di cui vuoi vedere gli avvisi
          </p>
        </div>

        {caricamento ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-scherma-blue border-t-transparent
                            rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {societa.map(s => (
              <button key={s.id} onClick={() => apriSocieta(s.id, s.iscrizione)}
                className="w-full bg-white rounded-2xl border border-gray-100
                           p-4 flex items-center gap-4 hover:border-scherma-blue
                           hover:shadow-sm transition-all text-left">

                <div className="w-12 h-12 rounded-xl bg-scherma-navy flex items-center
                                justify-center flex-shrink-0 overflow-hidden">
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt={s.nome}
                         className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-lg font-bold">
                      {s.nome?.charAt(0) || '?'}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {s.nome}
                  </p>
                  <p className="text-gray-400 text-xs">{s.citta}</p>
                  <div className="mt-1">{badgeStato(s.iscrizione)}</div>
                </div>

                <svg className="w-5 h-5 text-gray-300 flex-shrink-0"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}

        <button onClick={logout}
          className="w-full mt-8 text-sm text-gray-400 hover:text-gray-600
                     transition-colors py-2">
          Esci dall'account
        </button>

      </div>
    </div>
  );
}
