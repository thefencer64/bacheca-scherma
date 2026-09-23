import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function Avviso() {
  const { societaId, id } = useParams();
  const navigate          = useNavigate();
  const [avviso, setAvviso]           = useState(null);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'societa', societaId, 'avvisi', id)).then(snap => {
      if (snap.exists()) setAvviso({ id: snap.id, ...snap.data() });
      setCaricamento(false);
    });
  }, [societaId, id]);

  function formatData(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('it-IT', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  if (caricamento) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-scherma-blue border-t-transparent
                      rounded-full animate-spin" />
    </div>
  );

  if (!avviso) return (
    <div className="text-center py-16">
      <p className="text-gray-400">Avviso non trovato</p>
    </div>
  );

  return (
    <div className="">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-scherma-blue text-sm mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 19l-7-7 7-7" />
        </svg>
        Torna alla bacheca
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        {avviso.pinned && (
          <div className="flex items-center gap-1 mb-3">
            <svg className="w-3 h-3 text-scherma-blue" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18
                       3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="text-xs text-scherma-blue font-medium">In evidenza</span>
          </div>
        )}

        <h1 className="text-xl font-bold text-gray-900 leading-snug mb-2">
          {avviso.titolo}
        </h1>

        <p className="text-xs text-gray-400 mb-4 capitalize">
          {formatData(avviso.dataCreazione)}
        </p>

        <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {avviso.corpo}
        </div>

        {/* Link allegati */}
        {avviso.links?.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Link correlati</p>
            <div className="space-y-2">
              {avviso.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noreferrer"
                   className="flex items-center gap-2 text-scherma-blue text-sm
                              hover:underline">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none"
                       viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14
                             4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {link.etichetta || link.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
