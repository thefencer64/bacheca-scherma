import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import BannerPush from '../../components/ui/BannerPush';

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

const CATEGORIE_COLORI = {
  minions:     'bg-yellow-100 text-yellow-700',
  generale:    'bg-gray-100 text-gray-600',
  bambini:     'bg-pink-100 text-pink-700',
  giovanissimi:'bg-purple-100 text-purple-700',
  ragazzi:     'bg-blue-100 text-blue-700',
  allievi:     'bg-cyan-100 text-cyan-700',
  cadetti:     'bg-green-100 text-green-700',
  giovani:     'bg-yellow-100 text-yellow-700',
  under23:     'bg-orange-100 text-orange-700',
  assoluti:    'bg-amber-100 text-amber-700',
  master_0:    'bg-red-100 text-red-700',
  master_1:    'bg-red-100 text-red-700',
  master_2:    'bg-red-100 text-red-700',
  master_3:    'bg-red-100 text-red-700',
  master_4:    'bg-red-100 text-red-700',
  paralimpico: 'bg-violet-100 text-violet-700',
  integrata:   'bg-teal-100 text-teal-700',
  non_vedenti: 'bg-indigo-100 text-indigo-700',
};

export default function Bacheca() {
  const { societaId }               = useParams();
  const { utente }                  = useAuth();
  const navigate                    = useNavigate();
  const [avvisi, setAvvisi]         = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('tutti');
  const [categorieProprie, setCategorieProprie] = useState(undefined); // undefined=caricamento, null=mostra tutto

  // Registra l'ultima visita alla bacheca
  useEffect(() => {
    if (!utente || !societaId) return;
    updateDoc(
      doc(db, 'societa', societaId, 'iscrizioni', utente.uid),
      { ultimaVisita: serverTimestamp() }
    ).catch(() => {}); // ignora silenziosamente se l'iscrizione non esiste ancora
  }, [utente, societaId]);

  useEffect(() => {
    if (!utente || !societaId) return;

    const q = query(
      collection(db, 'societa', societaId, 'avvisi'),
      where('visibile', '==', true),
      orderBy('pinned', 'desc'),
      orderBy('dataCreazione', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setAvvisi(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCaricamento(false);
    });

    // Carica categorie proprie (iscrizione + figli)
    const caricaCategorie = async () => {
      const iscrizioneSnap = await getDoc(
        doc(db, 'societa', societaId, 'iscrizioni', utente.uid)
      );
      if (!iscrizioneSnap.exists()) return;

      const iscr = iscrizioneSnap.data();
      const cats = new Set(['generale']);

      // Categoria calcolata dell'utente
      if (iscr.categoriaCalcolata) cats.add(iscr.categoriaCalcolata);

      // Categorie da preferenze esplicite
      // Compatibile con struttura piatta e nested
      const prefNotifiche = iscr.preferenzeNotifiche || {};
      const pref = prefNotifiche.proprie || prefNotifiche;
      if (pref?.tutteLeCategorie) {
        setCategorieProprie(null); // mostra tutto
        return;
      }
      pref?.categorieIds?.forEach(c => cats.add(c));

      // Categorie dei figli
      const relazioniSnap = await getDocs(
        query(collection(db, 'societa', societaId, 'relazioni'),
              where('genitoreUid', '==', utente.uid))
      );
      for (const relDoc of relazioniSnap.docs) {
        const figlioIscr = await getDoc(
          doc(db, 'societa', societaId, 'iscrizioni', relDoc.data().figlioUid)
        );
        if (figlioIscr.exists() && figlioIscr.data().categoriaCalcolata) {
          cats.add(figlioIscr.data().categoriaCalcolata);
        }
      }

      setCategorieProprie([...cats]);
    };
    caricaCategorie().catch(() => {});

    return unsub;
  }, [utente, societaId]);

  const prontoPerMostrare = !caricamento && categorieProprie !== undefined;

  const avvisiPerUtente = avvisi.filter(a => {
    // Messaggio personale: visibile solo al destinatario
    if (a.destinatariUid?.length > 0) return a.destinatariUid.includes(utente.uid);
    // Avviso pubblico: logica categoria esistente
    if (categorieProprie === null) return true;
    if ((categorieProprie || []).length === 0) return true;
    return !a.categorieTarget?.length || a.categorieTarget.some(c => categorieProprie.includes(c));
  });

  const avvisiFiltrati = filtroCategoria === 'tutti'
    ? avvisiPerUtente
    : avvisiPerUtente.filter(a =>
        !a.categorieTarget?.length ||
        a.categorieTarget.includes(filtroCategoria)
      );

  const categoriePresenti = ['tutti', ...new Set(
    avvisiPerUtente.flatMap(a => a.categorieTarget?.length ? a.categorieTarget : ['generale'])
  )];

  function formatData(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  return (
    <div className="" style={{ paddingTop: "env(safe-area-inset-top)" }}>

      {/* Filtri categoria */}
      {categoriePresenti.length > 2 && (
        <div className="overflow-x-auto -mx-4 px-4 mb-4">
          <div className="flex gap-2 w-max">
            {categoriePresenti.map(cat => (
              <button key={cat} onClick={() => setFiltroCategoria(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium
                            whitespace-nowrap transition-colors
                            ${filtroCategoria === cat
                              ? 'bg-scherma-blue text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {cat === 'tutti' ? 'Tutti' : (CATEGORIE_LABEL[cat] || cat)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Banner push notification */}
      <BannerPush />

      {!prontoPerMostrare ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-scherma-blue border-t-transparent
                          rounded-full animate-spin" />
        </div>
      ) : avvisiFiltrati.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">Nessun avviso al momento</p>
        </div>
      ) : (
        <div className="space-y-3" style={{ width: "100%", overflow: "hidden" }}>
          {avvisiFiltrati.map(avviso => (
            <button key={avviso.id}
              onClick={() => navigate(`/${societaId}/avviso/${avviso.id}`)}
              className="w-full bg-white rounded-2xl border border-gray-100
                         p-4 text-left hover:border-scherma-blue hover:shadow-sm
                         transition-all"
              style={{ boxSizing: "border-box", maxWidth: "100%" }}>

              {avviso.pinned && (
                <div className="flex items-center gap-1 mb-2">
                  <svg className="w-3 h-3 text-scherma-blue" viewBox="0 0 24 24"
                       fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77
                             l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <span className="text-xs text-scherma-blue font-medium">
                    In evidenza
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm
                                 leading-snug line-clamp-2">
                    {avviso.titolo}
                  </h3>
                  <p className="text-gray-500 text-xs mt-1 line-clamp-2">
                    {avviso.corpo}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex flex-wrap gap-1">
                  {avviso.destinatariUid?.length > 0
                    ? (
                        <span className="text-xs px-2 py-0.5 rounded-full
                                         bg-purple-100 text-purple-700">
                          Messaggio
                        </span>
                      )
                    : avviso.categorieTarget?.length > 0
                    ? avviso.categorieTarget.slice(0, 2).map(cat => (
                        <span key={cat}
                              className={`text-xs px-2 py-0.5 rounded-full
                                         ${CATEGORIE_COLORI[cat] || 'bg-gray-100 text-gray-600'}`}>
                          {CATEGORIE_LABEL[cat] || cat}
                        </span>
                      ))
                    : (
                        <span className="text-xs px-2 py-0.5 rounded-full
                                         bg-gray-100 text-gray-600">
                          Generale
                        </span>
                      )
                  }
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatData(avviso.dataCreazione)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
