import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

const STATI = {
  in_attesa: {
    titolo:    'Richiesta inviata',
    messaggio: 'La tua richiesta è in attesa di approvazione da parte degli amministratori del club. Riceverai una email quando verrà approvata.',
    colore:    'bg-yellow-50 border-yellow-200',
    icona:     '⏳',
  },
  attesa_consenso: {
    titolo:    'In attesa di consenso',
    messaggio: 'La richiesta è in attesa del consenso genitoriale.',
    colore:    'bg-blue-50 border-blue-200',
    icona:     '👨‍👧',
  },
  attesa_admin: {
    titolo:    'In attesa di approvazione',
    messaggio: 'Il consenso è stato registrato. La richiesta è ora in attesa di approvazione da parte degli amministratori.',
    colore:    'bg-orange-50 border-orange-200',
    icona:     '⏳',
  },
  da_rinnovare: {
    titolo:    'Rinnovo richiesto',
    messaggio: 'Il tuo account è in attesa di rinnovo per la nuova stagione schermistica. Contatta gli amministratori del club.',
    colore:    'bg-yellow-50 border-yellow-200',
    icona:     '🔄',
  },
  decaduto: {
    titolo:    'Iscrizione decaduta',
    messaggio: 'La tua iscrizione è decaduta perché non è stata rinnovata entro i termini. Puoi richiedere una nuova iscrizione.',
    colore:    'bg-red-50 border-red-200',
    icona:     '❌',
  },
  sospeso: {
    titolo:    'Account sospeso',
    messaggio: 'Il tuo account è stato sospeso. Contatta gli amministratori del club per ulteriori informazioni.',
    colore:    'bg-red-50 border-red-200',
    icona:     '🚫',
  },
};

export default function StatoIscrizione() {
  const { societaId }   = useParams();
  const { utente }      = useAuth();
  const navigate        = useNavigate();
  const [societa, setSocieta]     = useState(null);
  const [iscrizione, setIscrizione] = useState(null);

  useEffect(() => {
    if (!societaId || !utente) return;

    getDoc(doc(db, 'societa', societaId)).then(snap => {
      if (snap.exists()) setSocieta({ id: snap.id, ...snap.data() });
    });

    // Listener realtime — se l'admin approva, reindirizza subito
    const unsub = onSnapshot(
      doc(db, 'societa', societaId, 'iscrizioni', utente.uid),
      (snap) => {
        if (!snap.exists()) return;
        const dati = snap.data();
        setIscrizione(dati);

        // Se approvato, vai alla bacheca
        if (dati.statoAccount === 'attivo') {
          if (dati.ruoli?.includes('admin')) {
            navigate(`/${societaId}/admin`);
          } else {
            navigate(`/${societaId}`);
          }
        }
      }
    );
    return unsub;
  }, [societaId, utente]);

  const stato = iscrizione ? STATI[iscrizione.statoAccount] : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center
                    justify-center px-4 overflow-y-auto" style={{ paddingBottom: "2rem" }}
         style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="w-full max-w-sm text-center">

        {/* Logo società */}
        <div className="w-16 h-16 bg-scherma-navy rounded-2xl flex items-center
                        justify-center mx-auto mb-4 overflow-hidden">
          {societa?.logoUrl ? (
            <img src={societa.logoUrl} alt={societa.nome}
                 className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-2xl font-bold">
              {societa?.nome?.charAt(0) || '?'}
            </span>
          )}
        </div>

        <h1 className="text-lg font-bold text-scherma-navy mb-1">
          {societa?.nome}
        </h1>

        {stato && (
          <div className={`mt-6 rounded-2xl border p-6 text-left ${stato.colore}`}>
            <div className="text-4xl mb-3 text-center">{stato.icona}</div>
            <h2 className="font-bold text-gray-900 text-center mb-2">
              {stato.titolo}
            </h2>
            <p className="text-sm text-gray-600 text-center leading-relaxed">
              {stato.messaggio}
            </p>
          </div>
        )}

        {iscrizione?.statoAccount === 'decaduto' && (
          <button
            onClick={() => navigate(`/iscriviti/${societaId}`)}
            className="mt-4 w-full bg-scherma-blue text-white py-3 rounded-xl
                       font-medium text-sm">
            Richiedi nuova iscrizione
          </button>
        )}

        <button
          onClick={() => navigate('/scegli-societa')}
          className="mt-4 w-full text-gray-400 text-sm py-2">
          Torna alla scelta società
        </button>

      </div>
    </div>
  );
}
