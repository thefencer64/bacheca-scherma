import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

export default function CompletaProfilo() {
  const { utente, logout, refreshProfilo } = useAuth();
  const navigate           = useNavigate();
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore]           = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm();

  async function onSubmit(dati) {
    setCaricamento(true);
    setErrore('');
    try {
      await updateDoc(doc(db, 'utenti', utente.uid), {
        dataNascita:     dati.dataNascita,
        telefono:        dati.telefono || '',
        profiloCompleto: true,
        aggiornatoAt:    serverTimestamp(),
      });
      await refreshProfilo();
      navigate('/');
    } catch (e) {
      console.error('Errore salvataggio profilo:', e.code, e.message);
      setErrore('Errore: ' + e.message);
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center
                    justify-center px-4 overflow-y-auto" style={{ paddingBottom: "2rem" }}
         style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mb-8 text-center">
                  <img src="https://firebasestorage.googleapis.com/v0/b/fcbachecascherma.firebasestorage.app/o/bacheca_scherma_icon.png?alt=media&token=1e294cb8-eb47-468b-a302-b71de444ec63" alt="Bacheca Scherma" className="w-16 h-16 rounded-2xl mx-auto mb-4" style={{objectFit: "cover"}} />
        <h1 className="text-xl font-bold text-scherma-navy">Completa il profilo</h1>
        <p className="text-gray-500 text-sm mt-1">
          Abbiamo bisogno di qualche informazione in più
        </p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm
                      border border-gray-100 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data di nascita *
            </label>
            <input type="date"
              className="w-full px-4 py-3 rounded-xl border border-gray-200
                         focus:outline-none focus:ring-2 focus:ring-scherma-blue"
              style={{ fontSize: '16px' }}
              {...register('dataNascita', { required: 'Obbligatoria' })}
            />
            {errors.dataNascita && (
              <p className="text-red-500 text-xs mt-1">
                {errors.dataNascita.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefono
            </label>
            <input type="tel"
              className="w-full px-4 py-3 rounded-xl border border-gray-200
                         focus:outline-none focus:ring-2 focus:ring-scherma-blue"
              style={{ fontSize: '16px' }}
              placeholder="+39 333 1234567"
              {...register('telefono')}
            />
          </div>

          {errore && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{errore}</p>
            </div>
          )}

          <button type="submit" disabled={caricamento}
            className="w-full bg-scherma-blue text-white py-3 rounded-xl
                       font-medium text-sm hover:bg-blue-700 transition-colors
                       disabled:opacity-50">
            {caricamento ? 'Salvataggio...' : 'Continua'}
          </button>

        </form>
      </div>

      <button onClick={logout}
        className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors py-2">
        Esci dall'account
      </button>

    </div>
  );
}
