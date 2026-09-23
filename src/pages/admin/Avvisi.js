import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, deleteDoc,
         orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AdminAvvisi() {
  const { societaId } = useParams();
  const navigate      = useNavigate();
  const [avvisi, setAvvisi]           = useState([]);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    if (!societaId) return;
    const q = query(
      collection(db, 'societa', societaId, 'avvisi'),
      orderBy('dataCreazione', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setAvvisi(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCaricamento(false);
    });
    return unsub;
  }, [societaId]);

  async function toggleVisibile(avviso) {
    await updateDoc(
      doc(db, 'societa', societaId, 'avvisi', avviso.id),
      { visibile: !avviso.visibile }
    );
  }

  async function togglePinned(avviso) {
    await updateDoc(
      doc(db, 'societa', societaId, 'avvisi', avviso.id),
      { pinned: !avviso.pinned }
    );
  }

  async function elimina(id) {
    if (!window.confirm('Eliminare questo avviso?')) return;
    await deleteDoc(doc(db, 'societa', societaId, 'avvisi', id));
  }

  function formatData(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }

  return (
    <div className="">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Avvisi</h2>
        <button onClick={() => navigate(`/${societaId}/admin/avvisi/nuovo`)}
          className="bg-scherma-blue text-white text-sm px-4 py-2 rounded-xl
                     font-medium flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v16m8-8H4" />
          </svg>
          Nuovo
        </button>
      </div>

      {caricamento ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-scherma-blue border-t-transparent
                          rounded-full animate-spin" />
        </div>
      ) : avvisi.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">Nessun avviso ancora</p>
          <button onClick={() => navigate(`/${societaId}/admin/avvisi/nuovo`)}
            className="mt-4 text-scherma-blue text-sm font-medium">
            Crea il primo avviso
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {avvisi.map(avviso => (
            <div key={avviso.id}
                 className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1">
                  {avviso.titolo}
                </h3>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatData(avviso.dataCreazione)}
                </span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 mb-3">{avviso.corpo}</p>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Toggle visibile */}
                <button onClick={() => toggleVisibile(avviso)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium
                              transition-colors
                              ${avviso.visibile
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'}`}>
                  {avviso.visibile ? 'Pubblicato' : 'Bozza'}
                </button>

                {/* Toggle pin */}
                <button onClick={() => togglePinned(avviso)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium
                              transition-colors
                              ${avviso.pinned
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500'}`}>
                  {avviso.pinned ? 'In evidenza' : 'Normale'}
                </button>

                {/* Push */}
                {avviso.pushInviata && (
                  <span className="text-xs px-3 py-1.5 rounded-full
                                   bg-purple-100 text-purple-700">
                    Push inviata
                  </span>
                )}

                {/* Modifica */}
                <button onClick={() => navigate(`/${societaId}/admin/avvisi/${avviso.id}/modifica`)}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600
                             transition-colors p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                             m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Elimina */}
                <button onClick={() => elimina(avviso.id)}
                  className="text-xs text-red-400 hover:text-red-600
                             transition-colors p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0
                             01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0
                             00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
