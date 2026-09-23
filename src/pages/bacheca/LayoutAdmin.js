import React, { useEffect, useState } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function LayoutAdmin() {
  const { societaId }         = useParams();
  const navigate              = useNavigate();
  const location              = useLocation();
  const [societa, setSocieta] = useState(null);
  const [notifichePendenti, setNotifichePendenti] = useState(0);

  useEffect(() => {
    if (!societaId) return;
    getDoc(doc(db, 'societa', societaId)).then(snap => {
      if (snap.exists()) setSocieta({ id: snap.id, ...snap.data() });
    });

    // Conta notifiche admin non lette (polling ogni 30s)
    const caricaNotifiche = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'societa', societaId, 'notificheAdmin'),
          where('letta', '==', false)
        ));
        setNotifichePendenti(snap.size);
      } catch (e) { /* silenzioso */ }
    };
    caricaNotifiche();
    const interval = setInterval(caricaNotifiche, 30000);
    return () => clearInterval(interval);
  }, [societaId]);

  const isActive = (path) =>
    location.pathname === `/${societaId}/admin${path}` ||
    (path === '' && location.pathname === `/${societaId}/admin`);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">

      {/* Header admin */}
      <header className="bg-scherma-navy text-white px-4 py-3
                         flex items-center gap-3 sticky top-0 z-10">
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center
                        justify-center overflow-hidden flex-shrink-0">
          {societa?.logoUrl ? (
            <img src={societa.logoUrl} alt={societa.nome}
                 className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-sm font-bold">
              {societa?.nome?.charAt(0) || '?'}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm truncate">{societa?.nome || '...'}</h1>
          <p className="text-xs text-white/60">Pannello amministrazione</p>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => navigate(`/${societaId}`)}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-xs
                       text-white/70 hover:text-white">
            Vista utente
          </button>
          <button onClick={() => navigate('/scegli-societa')}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            title="Cambia società">
            <svg className="w-5 h-5 text-white/70" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4">
        <Outlet />
      </main>

      {/* Bottom nav admin */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100
                      flex max-w-lg mx-auto z-10">

        <AdminNavItem label="Dashboard" active={isActive('')}
          onClick={() => navigate(`/${societaId}/admin`)}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1
                     1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1
                     1 0 001 1m-6 0h6" />
          </svg>}
        />

        <AdminNavItem label="Iscritti" active={isActive('/iscritti')}
          badge={notifichePendenti}
          onClick={() => navigate(`/${societaId}/admin/iscritti`)}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7
                     20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002
                     0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>}
        />

        <AdminNavItem label="Avvisi" active={isActive('/avvisi')}
          onClick={() => navigate(`/${societaId}/admin/avvisi`)}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2
                     2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>}
        />

      </nav>
    </div>
  );
}

function AdminNavItem({ label, active, onClick, icon, badge }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors relative
                  ${active ? 'text-scherma-navy' : 'text-gray-400 hover:text-gray-600'}`}>
      <div className="relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white
                           text-xs rounded-full flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
