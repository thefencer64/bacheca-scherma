import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

export default function NuovoAvviso() {
  const { societaId }   = useParams();
  const { utente }      = useAuth();
  const navigate        = useNavigate();
  const [categorie, setCategorie]     = useState([]);
  const [caricamento, setCaricamento] = useState(false);
  const [links, setLinks]             = useState([]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { visibile: true, pinned: false }
  });

  useEffect(() => {
    getDoc(doc(db, 'configCategorie', 'corrente')).then(snap => {
      if (snap.exists()) setCategorie(snap.data().categorie || []);
    });
  }, []);

  async function onSubmit(dati) {
    setCaricamento(true);
    try {
      const categorieTarget = dati.categorieTarget
        ? (Array.isArray(dati.categorieTarget)
            ? dati.categorieTarget
            : [dati.categorieTarget]).filter(Boolean)
        : [];

      await addDoc(collection(db, 'societa', societaId, 'avvisi'), {
        titolo:          dati.titolo,
        corpo:           dati.corpo,
        categorieTarget,
        links:           links.filter(l => l.url),
        autoreUid:       utente.uid,
        dataCreazione:   serverTimestamp(),
        pinned:          dati.pinned || false,
        visibile:        dati.visibile !== false,
        pushInviata:     false,
      });
      navigate(`/${societaId}/admin/avvisi`);
    } catch (e) {
      alert('Errore: ' + e.message);
    } finally {
      setCaricamento(false);
    }
  }

  function aggiungiLink() {
    setLinks(prev => [...prev, { url: '', etichetta: '' }]);
  }

  function aggiornaLink(i, campo, valore) {
    setLinks(prev => prev.map((l, idx) =>
      idx === i ? { ...l, [campo]: valore } : l
    ));
  }

  function rimuoviLink(i) {
    setLinks(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24"
               stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-gray-900">Nuovo avviso</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titolo *
          </label>
          <input type="text"
            className="w-full px-4 py-3 rounded-xl border border-gray-200
                       focus:outline-none focus:ring-2 focus:ring-scherma-blue"
            style={{ fontSize: '16px' }}
            placeholder="Es. Convocazione allenamento"
            {...register('titolo', { required: 'Titolo obbligatorio' })}
          />
          {errors.titolo && <p className="text-red-500 text-xs mt-1">{errors.titolo.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Testo *
          </label>
          <textarea rows={6}
            className="w-full px-4 py-3 rounded-xl border border-gray-200
                       focus:outline-none focus:ring-2 focus:ring-scherma-blue resize-none"
            style={{ fontSize: '16px' }}
            placeholder="Scrivi qui il testo dell'avviso..."
            {...register('corpo', { required: 'Testo obbligatorio' })}
          />
          {errors.corpo && <p className="text-red-500 text-xs mt-1">{errors.corpo.message}</p>}
        </div>

        {/* Categorie destinatarie */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Destinatari
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Nessuna selezione = avviso generale per tutti
          </p>
          <div className="flex flex-wrap gap-2">
            {categorie.map(cat => (
              <label key={cat.id}
                     className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" value={cat.id}
                  className="w-4 h-4 rounded border-gray-300 text-scherma-blue
                             focus:ring-scherma-blue"
                  {...register('categorieTarget')}
                />
                <span className="text-sm text-gray-700">{cat.etichetta}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Link */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Link allegati
            </label>
            <button type="button" onClick={aggiungiLink}
              className="text-sm text-scherma-blue font-medium">
              + Aggiungi
            </button>
          </div>
          {links.map((link, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input type="url" placeholder="https://..."
                value={link.url}
                onChange={e => aggiornaLink(i, 'url', e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200
                           focus:outline-none focus:ring-2 focus:ring-scherma-blue"
                style={{ fontSize: '16px' }}
              />
              <input type="text" placeholder="Etichetta"
                value={link.etichetta}
                onChange={e => aggiornaLink(i, 'etichetta', e.target.value)}
                className="w-28 px-3 py-2 rounded-xl border border-gray-200
                           focus:outline-none focus:ring-2 focus:ring-scherma-blue"
                style={{ fontSize: '16px' }}
              />
              <button type="button" onClick={() => rimuoviLink(i)}
                className="p-2 text-red-400 hover:text-red-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Opzioni */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-700">Pubblica subito</p>
              <p className="text-xs text-gray-400">
                Se disattivato viene salvato come bozza
              </p>
            </div>
            <input type="checkbox"
              className="w-5 h-5 rounded border-gray-300 text-scherma-blue"
              {...register('visibile')}
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-700">In evidenza</p>
              <p className="text-xs text-gray-400">Appare sempre in cima alla bacheca</p>
            </div>
            <input type="checkbox"
              className="w-5 h-5 rounded border-gray-300 text-scherma-blue"
              {...register('pinned')}
            />
          </label>
        </div>

        <button type="submit" disabled={caricamento}
          className="w-full bg-scherma-blue text-white py-4 rounded-2xl
                     font-semibold text-sm hover:bg-blue-700 transition-colors
                     disabled:opacity-50">
          {caricamento ? 'Pubblicazione...' : 'Pubblica avviso'}
        </button>

      </form>
    </div>
  );
}
