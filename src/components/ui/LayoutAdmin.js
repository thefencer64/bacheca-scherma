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
    location.pathname.startsWith(`/${societaId}/admin${path}/`) ||
    (path === '' && location.pathname === `/${societaId}/admin`);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(var(--vh, 1vh) * 100)',
      width: '100%',
      maxWidth: '512px',
      margin: '0 auto',
      backgroundColor: '#f9fafb',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>

      {/* Header admin fisso */}
      <header style={{
        backgroundColor: '#00244F',
        color: '#fff',
        padding: '0.75rem 1rem',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {societa?.logoUrl ? (
            <img src={societa.logoUrl} alt={societa.nome}
                 style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
              {societa?.nome?.charAt(0) || '?'}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: '#fff', margin: 0,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {societa?.nome || '...'}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            Amministrazione
          </p>
        </div>

        <button onClick={() => navigate(`/${societaId}`)}
          style={{ padding: '4px 8px', borderRadius: 8, background: 'none',
                   border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
                   color: 'rgba(255,255,255,0.8)', fontSize: 11,
                   whiteSpace: 'nowrap', flexShrink: 0 }}>
          ← Bacheca
        </button>
      </header>

      {/* Area scrollabile */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '1rem',
        WebkitOverflowScrolling: 'touch',
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          <Outlet />
        </div>
      </main>

      {/* Bottom nav fissa */}
      <nav style={{
        backgroundColor: '#fff',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        flexShrink: 0,
      }}>
        <AdminNavItem label="Dashboard" active={isActive('')}
          onClick={() => navigate(`/${societaId}/admin`)}
          icon={
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1
                       1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1
                       1 0 001 1m-6 0h6" />
            </svg>
          }
        />
        <AdminNavItem label="Iscritti" active={isActive('/iscritti')}
          badge={notifichePendenti}
          onClick={() => navigate(`/${societaId}/admin/iscritti`)}
          icon={
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7
                       20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002
                       0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <AdminNavItem label="Avvisi" active={isActive('/avvisi')}
          onClick={() => navigate(`/${societaId}/admin/avvisi`)}
          icon={
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2
                       2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
        />
        <AdminNavItem label="Categorie" active={isActive('/categorie')}
          onClick={() => navigate(`/${societaId}/admin/categorie`)}
          icon={
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14
                       0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
      </nav>
    </div>
  );
}

function AdminNavItem({ label, active, onClick, icon, badge }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4, padding: '0.75rem 0',
      background: 'none', border: 'none', cursor: 'pointer',
      color: active ? '#00244F' : '#aaa',
      position: 'relative',
      transition: 'color 0.2s',
    }}>
      <div style={{ position: 'relative' }}>
        {icon}
        {badge > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 16, height: 16,
            backgroundColor: '#ef4444', color: '#fff',
            fontSize: 10, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600,
          }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </button>
  );
}
