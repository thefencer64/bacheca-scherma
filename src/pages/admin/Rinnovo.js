import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../lib/firebase';

function buildCategoriePerStagione(stagione) {
  const annoRef = parseInt(stagione.split('-')[0], 10);
  if (isNaN(annoRef)) return null;
  const y = (offset) => String(annoRef + offset);
  const d = (anno, m, g) => `${anno}-${m}-${g}`;
  return [
    { id: 'generale',     etichetta: 'Avvisi generali',             anniNascita: [], isMaster: false, sottocategoria: null, dataNascitaDal: null,           dataNascitaAl: null,           ordine: 0  },
    { id: 'minions',      etichetta: 'Minions',                     anniNascita: [], isMaster: false, isSpeciale: false, sottocategoria: null, dataNascitaDal: d(y(-9),'01','01'), dataNascitaAl: null, ordine: 0 },
    { id: 'bambini',      etichetta: 'Bambine / Maschietti',        anniNascita: [annoRef - 10], isMaster: false, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 1 },
    { id: 'giovanissimi', etichetta: 'Giovanissime / Giovanissimi', anniNascita: [annoRef - 11], isMaster: false, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 2 },
    { id: 'ragazzi',      etichetta: 'Ragazze / Ragazzi',           anniNascita: [annoRef - 12], isMaster: false, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 3 },
    { id: 'allievi',      etichetta: 'Allieve / Allievi',           anniNascita: [annoRef - 13], isMaster: false, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 4 },
    { id: 'cadetti',      etichetta: 'Cadetti (M/F)',               anniNascita: [], isMaster: false, sottocategoria: null, dataNascitaDal: d(y(-16),'01','01'), dataNascitaAl: d(y(-14),'12','31'), ordine: 5 },
    { id: 'giovani',      etichetta: 'Giovani (M/F)',               anniNascita: [], isMaster: false, sottocategoria: null, dataNascitaDal: d(y(-19),'01','01'), dataNascitaAl: d(y(-17),'12','31'), ordine: 6 },
    { id: 'under23',      etichetta: 'Under 23',                    anniNascita: [], isMaster: false, sottocategoria: null, dataNascitaDal: d(y(-22),'01','01'), dataNascitaAl: d(y(-20),'12','31'), ordine: 7  },
    { id: 'assoluti',     etichetta: 'Assoluti',                    anniNascita: [], isMaster: false, sottocategoria: null, dataNascitaDal: d(y(-22),'01','01'), dataNascitaAl: d(y(-14),'12','31'), ordine: 13 },
    { id: 'master_0',     etichetta: 'Master Cat. 0 (over 24)',     anniNascita: [], isMaster: true,  sottocategoria: '0', dataNascitaDal: d(y(-38),'01','01'), dataNascitaAl: d(y(-23),'12','31'), ordine: 13 },
    { id: 'master_1',     etichetta: 'Master Cat. 1 (over 40)',     anniNascita: [], isMaster: true,  sottocategoria: '1', dataNascitaDal: d(y(-48),'01','01'), dataNascitaAl: d(y(-39),'12','31'), ordine: 13 },
    { id: 'master_2',     etichetta: 'Master Cat. 2 (over 50)',     anniNascita: [], isMaster: true,  sottocategoria: '2', dataNascitaDal: d(y(-58),'01','01'), dataNascitaAl: d(y(-49),'12','31'), ordine: 13 },
    { id: 'master_3',     etichetta: 'Master Cat. 3 (over 60)',     anniNascita: [], isMaster: true,  sottocategoria: '3', dataNascitaDal: d(y(-68),'01','01'), dataNascitaAl: d(y(-59),'12','31'), ordine: 13 },
    { id: 'master_4',     etichetta: 'Master Cat. 4 (over 70)',     anniNascita: [], isMaster: true,  sottocategoria: '4', dataNascitaDal: null,               dataNascitaAl: d(y(-69),'12','31'), ordine: 13 },
    { id: 'paralimpico',  etichetta: 'Paralimpico',                 anniNascita: [], isMaster: false, isSpeciale: true, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 13 },
    { id: 'integrata',    etichetta: 'Scherma Integrata',           anniNascita: [], isMaster: false, isSpeciale: true, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 14 },
    { id: 'non_vedenti',  etichetta: 'Non Vedenti',                 anniNascita: [], isMaster: false, isSpeciale: true, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 15 },
  ];
}

// Estrae l'anno (numero) dalla stringa data "YYYY-MM-DD"
function annoFromData(dataStr) {
  if (!dataStr) return '';
  return parseInt(dataStr.split('-')[0], 10);
}

// Aggiorna l'anno mantenendo mese e giorno originali
function setAnnoInData(dataStr, nuovoAnno) {
  if (!dataStr) return null;
  const parti = dataStr.split('-');
  return `${nuovoAnno}-${parti[1]}-${parti[2]}`;
}

// Categorie che hanno annate editabili (esclude generale e speciali)
function categorieEditabili(cats) {
  return cats.filter(c => c.id !== 'generale' && !c.isSpeciale);
}

export default function AdminRinnovo() {
  const { societaId }                   = useParams();
  const [societa, setSocieta]           = useState(null);
  const [iscritti, setIscritti]         = useState([]);
  const [utenti, setUtenti]             = useState({});
  const [selezionati, setSelezionati]   = useState({});
  const [caricamento, setCaricamento]   = useState(true);
  const [elaborazione, setElaborazione] = useState(false);
  const [nuovoAnno, setNuovoAnno]       = useState('2026-2027');
  const [mostraPreview, setMostraPreview] = useState(false);
  const [categorieEdit, setCategorieEdit] = useState([]);

  const functions = getFunctions(undefined, 'europe-west1');

  function validaAnno(anno) {
    if (!/^\d{4}-\d{4}$/.test(anno)) return false;
    const [a, b] = anno.split('-').map(Number);
    return b === a + 1;
  }

  useEffect(() => {
    if (!societaId) return;
    Promise.all([
      getDoc(doc(db, 'societa', societaId)),
      getDocs(collection(db, 'societa', societaId, 'iscrizioni')),
    ]).then(async ([societaSnap, iscrizioniSnap]) => {
      if (societaSnap.exists()) setSocieta(societaSnap.data());

      const lista = iscrizioniSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(i => i.statoAccount === 'attivo' || i.statoAccount === 'da_rinnovare');

      setIscritti(lista);
      const sel = {};
      lista.forEach(i => sel[i.id] = true);
      setSelezionati(sel);

      const uMap = {};
      await Promise.all(lista.map(async i => {
        const snap = await getDoc(doc(db, 'utenti', i.id));
        if (snap.exists()) uMap[i.id] = snap.data();
      }));
      setUtenti(uMap);
      setCaricamento(false);
    });
  }, [societaId]);

  function toggleTutti() {
    const tutti = iscritti.every(i => selezionati[i.id]);
    const sel = {};
    if (!tutti) iscritti.forEach(i => sel[i.id] = true);
    setSelezionati(sel);
  }

  function handleApriClick() {
    if (!validaAnno(nuovoAnno)) { alert('Formato stagione non valido. Usa AAAA-AAAA (es. 2026-2027)'); return; }
    const cats = buildCategoriePerStagione(nuovoAnno);
    setCategorieEdit(cats);
    setMostraPreview(true);
  }

  function aggiornaAnnoNascita(id, idx, valore) {
    setCategorieEdit(prev => prev.map(c => {
      if (c.id !== id) return c;
      const nuovi = [...c.anniNascita];
      nuovi[idx] = parseInt(valore) || 0;
      return { ...c, anniNascita: nuovi };
    }));
  }

  function aggiornaDal(id, valore) {
    setCategorieEdit(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { ...c, dataNascitaDal: valore ? setAnnoInData(c.dataNascitaDal || `${valore}-01-01`, valore) : null };
    }));
  }

  function aggiornaAl(id, valore) {
    setCategorieEdit(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { ...c, dataNascitaAl: valore ? setAnnoInData(c.dataNascitaAl || `${valore}-12-31`, valore) : null };
    }));
  }

  async function handleConfermaApri() {
    if (!window.confirm(`Aprire il rinnovo per la stagione ${nuovoAnno}?\n\nTutti gli iscritti attivi passeranno allo stato "da rinnovare".`)) return;
    setElaborazione(true);
    try {
      const fn = httpsCallable(functions, 'apriRinnovo');
      const result = await fn({ societaId, nuovoAnno, categorie: categorieEdit });
      setMostraPreview(false);
      alert(`Rinnovo aperto. ${result.data.totale} iscritti da rinnovare.`);
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setElaborazione(false);
    }
  }

  async function confermaRinnovi() {
    if (!validaAnno(nuovoAnno)) { alert('Formato stagione non valido.'); return; }
    const uids = Object.entries(selezionati).filter(([, v]) => v).map(([k]) => k);
    if (uids.length === 0) { alert('Nessun iscritto selezionato'); return; }
    if (!window.confirm(`Rinnovare ${uids.length} iscrizioni per la stagione ${nuovoAnno}?`)) return;
    setElaborazione(true);
    try {
      const fn = httpsCallable(functions, 'confermaRinnovi');
      const result = await fn({ societaId, uids, nuovoAnno });
      alert(`${result.data.rinnovati} iscrizioni rinnovate.`);
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setElaborazione(false);
    }
  }

  async function chiudiRinnovo() {
    if (!validaAnno(nuovoAnno)) { alert('Formato stagione non valido.'); return; }
    if (!window.confirm('Chiudere il rinnovo? Chi non ha rinnovato decadrà.')) return;
    setElaborazione(true);
    try {
      const fn = httpsCallable(functions, 'chiudiRinnovo');
      const result = await fn({ societaId, nuovoAnno });
      alert(`Rinnovo chiuso. ${result.data.decaduti} iscrizioni decadute.`);
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setElaborazione(false);
    }
  }

  const tuttiSelezionati = iscritti.length > 0 && iscritti.every(i => selezionati[i.id]);

  const inputAnnoStyle = {
    width: 68, padding: '4px 6px', borderRadius: 6,
    border: '1px solid #d1d5db', fontSize: 16,
    textAlign: 'center', outline: 'none',
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-5">Rinnovo annuale</h2>

      {/* Configurazione */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-4">

        {!mostraPreview ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nuova stagione</label>
              <input type="text" value={nuovoAnno}
                onChange={e => setNuovoAnno(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200
                           focus:outline-none focus:ring-2 focus:ring-scherma-blue"
                style={{ fontSize: '16px' }}
              />
            </div>
            <button onClick={handleApriClick}
              className="w-full bg-yellow-500 text-white py-3 rounded-xl font-medium text-sm">
              Apri periodo di rinnovo
            </button>
          </>
        ) : (
          <>
            {/* Header preview */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>Categorie stagione {nuovoAnno}</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Verifica e modifica gli anni prima di confermare</p>
              </div>
              <button onClick={() => setMostraPreview(false)}
                style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none',
                         cursor: 'pointer', padding: '4px 8px' }}>
                ← Indietro
              </button>
            </div>

            {/* Lista categorie editabili */}
            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12,
                          display: 'flex', flexDirection: 'column', gap: 10 }}>
              {categorieEditabili(categorieEdit).map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center',
                                           justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{cat.etichetta}</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {/* Categorie con anniNascita */}
                    {cat.anniNascita && cat.anniNascita.length > 0 && (
                      cat.anniNascita.map((anno, idx) => (
                        <input key={idx} type="number" value={anno}
                          onChange={e => aggiornaAnnoNascita(cat.id, idx, e.target.value)}
                          style={inputAnnoStyle}
                        />
                      ))
                    )}

                    {/* Categorie con solo dataNascitaDal (minions) */}
                    {(!cat.anniNascita || cat.anniNascita.length === 0) && cat.dataNascitaDal && !cat.dataNascitaAl && (
                      <>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>dal</span>
                        <input type="number" value={annoFromData(cat.dataNascitaDal)}
                          onChange={e => aggiornaDal(cat.id, e.target.value)}
                          style={inputAnnoStyle}
                        />
                      </>
                    )}

                    {/* Categorie con solo dataNascitaAl (master_4) */}
                    {(!cat.anniNascita || cat.anniNascita.length === 0) && !cat.dataNascitaDal && cat.dataNascitaAl && (
                      <>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>fino al</span>
                        <input type="number" value={annoFromData(cat.dataNascitaAl)}
                          onChange={e => aggiornaAl(cat.id, e.target.value)}
                          style={inputAnnoStyle}
                        />
                      </>
                    )}

                    {/* Categorie con entrambi i range */}
                    {(!cat.anniNascita || cat.anniNascita.length === 0) && cat.dataNascitaDal && cat.dataNascitaAl && (
                      <>
                        <input type="number" value={annoFromData(cat.dataNascitaDal)}
                          onChange={e => aggiornaDal(cat.id, e.target.value)}
                          style={inputAnnoStyle}
                        />
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>–</span>
                        <input type="number" value={annoFromData(cat.dataNascitaAl)}
                          onChange={e => aggiornaAl(cat.id, e.target.value)}
                          style={inputAnnoStyle}
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={handleConfermaApri} disabled={elaborazione}
              className="w-full bg-yellow-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50">
              {elaborazione ? 'Apertura in corso…' : 'Conferma e apri rinnovo'}
            </button>
          </>
        )}
      </div>

      {/* Lista iscritti con checkbox */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">
            Iscritti da rinnovare ({iscritti.length})
          </p>
          <button onClick={toggleTutti} className="text-xs text-scherma-blue font-medium">
            {tuttiSelezionati ? 'Deseleziona tutti' : 'Seleziona tutti'}
          </button>
        </div>

        {caricamento ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-scherma-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {iscritti.map(iscr => {
              const u = utenti[iscr.id] || {};
              return (
                <label key={iscr.id}
                       className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                  <input type="checkbox"
                    checked={!!selezionati[iscr.id]}
                    onChange={e => setSelezionati(prev => ({ ...prev, [iscr.id]: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-scherma-blue"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{u.nome} {u.cognome}</p>
                    <p className="text-xs text-gray-400">
                      {iscr.ruoli?.join(', ')}
                      {iscr.categoriaCalcolata && ` · ${iscr.categoriaCalcolata}`}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <button onClick={confermaRinnovi} disabled={elaborazione}
          className="w-full bg-scherma-blue text-white py-4 rounded-2xl font-semibold text-sm disabled:opacity-50">
          {elaborazione ? 'Elaborazione...' : 'Conferma rinnovi selezionati'}
        </button>
        <button onClick={chiudiRinnovo} disabled={elaborazione}
          className="w-full border border-red-200 text-red-500 py-3 rounded-2xl font-medium text-sm disabled:opacity-50">
          Chiudi rinnovo (fa decadere i non rinnovati)
        </button>
      </div>
    </div>
  );
}
