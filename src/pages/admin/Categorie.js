import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const CATEGORIE_ORDINE = [
  { id: 'minions',      label: 'Minions' },
  { id: 'bambini',      label: 'Bambine/Maschietti' },
  { id: 'giovanissimi', label: 'Giovanissimi' },
  { id: 'ragazzi',      label: 'Ragazze/Ragazzi' },
  { id: 'allievi',      label: 'Allieve/Allievi' },
  { id: 'cadetti',      label: 'Cadetti' },
  { id: 'giovani',      label: 'Giovani' },
  { id: 'under23',      label: 'Under 23' },
  { id: 'assoluti',     label: 'Assoluti' },
  { id: 'master_0',     label: 'Master Cat.0' },
  { id: 'master_1',     label: 'Master Cat.1' },
  { id: 'master_2',     label: 'Master Cat.2' },
  { id: 'master_3',     label: 'Master Cat.3' },
  { id: 'master_4',     label: 'Master Cat.4' },
  { id: 'paralimpico',  label: 'Paralimpico' },
  { id: 'integrata',    label: 'Scherma Integrata' },
  { id: 'non_vedenti',  label: 'Non Vedenti' },
];

export default function Categorie() {
  const { societaId }             = useParams();
  const [iscritti, setIscritti]   = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [vistaDestinatari, setVistaDestinatari] = useState(false);
  const [stagione, setStagione]       = useState(null);
  const [categorieCorrente, setCategorieCorrente] = useState([]);
  const [mostraDettaglio, setMostraDettaglio] = useState(false);

  useEffect(() => {
    if (!societaId) return;
    const functions = getFunctions(undefined, 'europe-west1');
    const fn = httpsCallable(functions, 'getIscritti');
    fn({ societaId })
      .then(r => {
        const tutti = r.data.iscrizioni || r.data.iscritti || [];
        const normalizzati = tutti
          .filter(i => i.statoAccount === 'attivo')
          .map(i => ({
            uid:                 i.id,
            statoAccount:        i.statoAccount,
            ruoli:               i.ruoli || [],
            categoriaCalcolata:  i.categoriaCalcolata || null,
            nome:                i.anagrafica?.nome || i.nome || '?',
            cognome:             i.anagrafica?.cognome || i.cognome || '?',
            preferenzeNotifiche: i.preferenzeNotifiche || {},
          }));
        setIscritti(normalizzati);
        setCaricamento(false);
      })
      .catch(() => setCaricamento(false));

    getDocFromServer(doc(db, 'configCategorie', 'corrente'))
      .then(snap => {
        if (snap.exists()) {
          setStagione(snap.data().stagione || '');
          setCategorieCorrente((snap.data().categorie || []).filter(c => c.id !== 'generale' && !c.isSpeciale));
        }
      })
      .catch(() => {});
  }, [societaId]);

  // Raggruppa per categoria calcolata (vista FIS)
  const perCategoria = {};
  iscritti.forEach(i => {
    const cat = i.categoriaCalcolata || 'nessuna';
    if (!perCategoria[cat]) perCategoria[cat] = [];
    perCategoria[cat].push(i);
  });

  // Raggruppa per categorie avvisi ricevuti (vista destinatari)
  const perDestinatario = {};
  iscritti.forEach(i => {
    const prefNotifiche = i.preferenzeNotifiche || {};
    const catsSet = new Set();

    if (i.ruoli?.includes('atleta')) {
      const pref = prefNotifiche.proprie || {};
      if (pref.tutteLeCategorie) {
        catsSet.add('tutte');
      } else {
        (pref.categorieIds || []).forEach(c => catsSet.add(c));
      }
    }

    if (i.ruoli?.includes('genitore')) {
      const prefFigli = prefNotifiche.perFigli || {};
      if (prefFigli.tutteLeCategorie) {
        catsSet.add('tutte');
      } else {
        (prefFigli.categorieIds || []).forEach(c => catsSet.add(c));
      }
    }

    const catsEffettive = catsSet.size === 0 ? ['generale'] : [...catsSet];
    catsEffettive.forEach(cat => {
      if (!perDestinatario[cat]) perDestinatario[cat] = [];
      perDestinatario[cat].push(i);
    });
  });

  const categorieDestinatariPresenti = CATEGORIE_ORDINE.filter(c =>
    perDestinatario[c.id]?.length > 0
  );

  if (caricamento) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-scherma-blue border-t-transparent
                      rounded-full animate-spin" />
    </div>
  );

  const categoriePresenti = CATEGORIE_ORDINE.filter(c =>
    perCategoria[c.id]?.length > 0
  );

  const nessuna = perCategoria['nessuna'] || [];

  return (
    <div className="space-y-4">

      {/* Card stagione corrente */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div style={{ backgroundColor: '#00244F', padding: '0.75rem 1rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Stagione</span>
            {stagione && (
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 8 }}>
                {stagione}
              </span>
            )}
          </div>
          <button
            onClick={() => setMostraDettaglio(v => !v)}
            style={{
              padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff', cursor: 'pointer',
            }}>
            {mostraDettaglio ? 'Nascondi' : 'Mostra'}
          </button>
        </div>

        {mostraDettaglio && (
          <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {categorieCorrente.map(c => {
              const anni = c.anniNascita?.length > 0
                ? c.anniNascita.join(', ')
                : [c.dataNascitaDal, c.dataNascitaAl]
                    .filter(Boolean)
                    .map(d => d.split('-')[0])
                    .join(' – ');
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#374151' }}>{c.etichetta}</span>
                  <span style={{ color: '#6b7280' }}>{anni || '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Categorie</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-500">
            {vistaDestinatari ? 'Destinatari avvisi' : 'Categorie FIS'}
          </span>
          <div
            onClick={() => setVistaDestinatari(v => !v)}
            style={{
              width: 40, height: 22, borderRadius: 11,
              backgroundColor: vistaDestinatari ? '#0179C0' : '#ccc',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
              flexShrink: 0,
            }}>
            <div style={{
              width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff',
              position: 'absolute', top: 2,
              left: vistaDestinatari ? 20 : 2,
              transition: 'left 0.2s',
            }} />
          </div>
        </label>
      </div>

      {categoriePresenti.length === 0 && nessuna.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-gray-400 text-sm">Nessun iscritto attivo</p>
        </div>
      )}

      {!vistaDestinatari && categoriePresenti.map(cat => (
        <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div style={{ backgroundColor: "#00244F", padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{cat.label}</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
              {perCategoria[cat.id].filter(i => i.ruoli?.includes('atleta')).length} atleti
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {perCategoria[cat.id]
              .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`))
              .map(i => {
                const isGenitore = i.ruoli?.includes('genitore') && !i.ruoli?.includes('atleta');
                const isAtletaGenitore = i.ruoli?.includes('genitore') && i.ruoli?.includes('atleta');
                return (
                  <div key={i.uid} className="px-4 py-2.5 flex items-center gap-3">
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      backgroundColor: isGenitore ? '#e8f0fe' : '#e8f5e9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600,
                        color: isGenitore ? '#3b4ea6' : '#2e7d32',
                      }}>
                        {i.nome?.charAt(0)}{i.cognome?.charAt(0)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p style={{
                        fontSize: 14, fontWeight: 500, margin: 0,
                        color: isGenitore ? '#3b4ea6' : '#111',
                      }}>
                        {i.cognome} {i.nome}
                      </p>
                      {isAtletaGenitore && (
                        <p style={{ fontSize: 11, color: '#888', margin: 0 }}>
                          atleta + genitore
                        </p>
                      )}
                    </div>

                    {isGenitore && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 6,
                        backgroundColor: '#e8f0fe', color: '#3b4ea6',
                        fontWeight: 500,
                      }}>
                        genitore
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      {vistaDestinatari && categorieDestinatariPresenti.map(cat => (
        <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div style={{ backgroundColor: "#0179C0", padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{cat.label}</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
              {perDestinatario[cat.id].length} iscritti
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {perDestinatario[cat.id]
              .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`))
              .map(i => {
                const isGenitore = i.ruoli?.includes('genitore') && !i.ruoli?.includes('atleta');
                return (
                  <div key={i.uid} className="px-4 py-2.5 flex items-center gap-3">
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      backgroundColor: isGenitore ? '#e8f0fe' : '#e8f5e9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600,
                        color: isGenitore ? '#3b4ea6' : '#2e7d32',
                      }}>
                        {i.nome?.charAt(0)}{i.cognome?.charAt(0)}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 14, fontWeight: 500, margin: 0,
                      color: isGenitore ? '#3b4ea6' : '#111',
                    }}>
                      {i.cognome} {i.nome}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      {vistaDestinatari && perDestinatario['tutte']?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div style={{ backgroundColor: "#0179C0", padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Tutte le categorie</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{perDestinatario['tutte'].length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {perDestinatario['tutte'].map(i => (
              <div key={i.uid} className="px-4 py-2.5 flex items-center gap-3">
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  backgroundColor: '#e8f5e9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2e7d32' }}>
                    {i.nome?.charAt(0)}{i.cognome?.charAt(0)}
                  </span>
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: '#111' }}>
                  {i.cognome} {i.nome}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!vistaDestinatari && nessuna.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-400 flex items-center justify-between">
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Senza categoria</span>
            <span className="text-gray-100 text-xs">{nessuna.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {nessuna.map(i => (
              <div key={i.uid} className="px-4 py-2.5 flex items-center gap-3">
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  backgroundColor: '#f5f5f5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#999' }}>
                    {i.nome?.charAt(0)}{i.cognome?.charAt(0)}
                  </span>
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: '#555' }}>
                  {i.cognome} {i.nome}
                </p>
                <div className="flex gap-1 ml-auto">
                  {i.ruoli?.map(r => (
                    <span key={r} style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 6,
                      backgroundColor: '#f0f0f0', color: '#888',
                    }}>{r}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Legenda
        </p>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#e8f5e9' }} />
            <span className="text-xs text-gray-600">Atleta</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#e8f0fe' }} />
            <span className="text-xs text-gray-600">Genitore</span>
          </div>
        </div>
      </div>
    </div>
  );
}
