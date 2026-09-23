import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AdminDashboard() {
  const { societaId } = useParams();
  const navigate      = useNavigate();
  const [stats, setStats] = useState({
    attivi: 0, inAttesa: 0, avvisi: 0, notifiche: 0
  });

  async function marcaTutteComeLette() {
    try {
      const snap = await getDocs(query(
        collection(db, 'societa', societaId, 'notificheAdmin'),
        where('letta', '==', false)
      ));
      if (snap.empty) return;
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.update(d.ref, { letta: true, lettaAt: new Date() }));
      await batch.commit();
    } catch(e) { console.error(e); }
  }

  useEffect(() => {
    if (!societaId) return;

    // Conta iscritti per stato
    const qIscrizioni = collection(db, 'societa', societaId, 'iscrizioni');
    const unsubIscritti = onSnapshot(qIscrizioni, snap => {
      const docs = snap.docs.map(d => d.data());
      setStats(prev => ({
        ...prev,
        attivi:    docs.filter(d => d.statoAccount === 'attivo').length,
        inAttesa:  docs.filter(d =>
          ['in_attesa','attesa_admin','attesa_consenso'].includes(d.statoAccount)
        ).length,
      }));
    });

    // Conta avvisi
    const qAvvisi = collection(db, 'societa', societaId, 'avvisi');
    const unsubAvvisi = onSnapshot(qAvvisi, snap => {
      setStats(prev => ({ ...prev, avvisi: snap.size }));
    });

    // Conta notifiche non lette
    const qNotifiche = query(
      collection(db, 'societa', societaId, 'notificheAdmin'),
      where('letta', '==', false)
    );
    const unsubNotifiche = onSnapshot(qNotifiche, snap => {
      setStats(prev => ({ ...prev, notifiche: snap.size }));
    });

    return () => { unsubIscritti(); unsubAvvisi(); unsubNotifiche(); };
  }, [societaId]);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-gray-900">Dashboard</h2>

      {/* Statistiche */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Iscritti attivi"  value={stats.attivi}
                  colore="bg-green-50 border-green-100" testoColore="text-green-700" />
        <StatCard label="In attesa"        value={stats.inAttesa}
                  colore="bg-yellow-50 border-yellow-100" testoColore="text-yellow-700"
                  onClick={() => navigate(`/${societaId}/admin/iscritti`)} />
        <StatCard label="Avvisi pubblicati" value={stats.avvisi}
                  colore="bg-blue-50 border-blue-100" testoColore="text-blue-700"
                  onClick={() => navigate(`/${societaId}/admin/avvisi`)} />
        <StatCard label="Notifiche non lette" value={stats.notifiche}
                  colore="bg-red-50 border-red-100" testoColore="text-red-700"
                  onClick={stats.notifiche > 0 ? marcaTutteComeLette : undefined} />
      </div>

      {/* Azioni rapide */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Azioni rapide
        </h3>

        <AzioneCard
          titolo="Pubblica avviso"
          descrizione="Crea un nuovo avviso per gli iscritti"
          onClick={() => navigate(`/${societaId}/admin/avvisi/nuovo`)}
          colore="bg-scherma-blue"
        />
        <AzioneCard
          titolo="Gestisci iscritti"
          descrizione={stats.inAttesa > 0
            ? `${stats.inAttesa} richieste in attesa di approvazione`
            : 'Visualizza e gestisci le iscrizioni'}
          onClick={() => navigate(`/${societaId}/admin/iscritti`)}
          colore="bg-scherma-navy"
          badge={stats.inAttesa}
        />
        <AzioneCard
          titolo="Rinnovo annuale"
          descrizione="Gestisci il rinnovo delle iscrizioni"
          onClick={() => navigate(`/${societaId}/admin/rinnovo`)}
          colore="bg-gray-700"
        />
        <AzioneCard
          titolo="Messaggio ad iscritti"
          descrizione="Invia un messaggio a uno o più iscritti"
          onClick={() => navigate(`/${societaId}/admin/messaggio`)}
          colore="bg-teal-600"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, colore, testoColore, onClick }) {
  return (
    <div onClick={onClick}
      className={`rounded-2xl border p-4 ${colore} ${onClick ? 'cursor-pointer' : ''}`}>
      <p className={`text-3xl font-bold ${testoColore}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function AzioneCard({ titolo, descrizione, onClick, colore, badge }) {
  return (
    <button onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-100 p-4
                 flex items-center gap-4 hover:shadow-sm transition-all text-left">
      <div className={`w-10 h-10 rounded-xl ${colore} flex items-center
                       justify-center flex-shrink-0`}>
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"
             stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-900 text-sm">{titolo}</p>
        <p className="text-xs text-gray-500 mt-0.5">{descrizione}</p>
      </div>
      {badge > 0 && (
        <span className="w-6 h-6 bg-red-500 text-white text-xs rounded-full
                         flex items-center justify-center font-medium">
          {badge}
        </span>
      )}
    </button>
  );
}
