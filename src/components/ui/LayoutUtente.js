import React, { useEffect, useState } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import { getSocietaId } from '../../lib/getSocietaId';

export default function LayoutUtente() {
  const { societaId }         = useParams();
  const navigate              = useNavigate();
  const location              = useLocation();
  const [societa, setSocieta]         = useState(null);
  const [statoIscrizione, setStatoIscrizione] = useState(null); // null=caricamento
  const [isAdmin, setIsAdmin]                 = useState(false);
  const { utente }                    = useAuth();

  useEffect(() => {
    if (!societaId) return;
    getDoc(doc(db, 'societa', societaId)).then(snap => {
      if (snap.exists()) setSocieta({ id: snap.id, ...snap.data() });
    });

    // Listener realtime sullo stato iscrizione
    if (!utente) return;
    const unsubIscrizione = onSnapshot(
      doc(db, 'societa', societaId, 'iscrizioni', utente.uid),
      (snap) => {
        if (snap.exists()) {
          const dati = snap.data();
          setStatoIscrizione(dati.statoAccount || 'in_attesa');
          setIsAdmin(dati.statoAccount === 'attivo' && dati.ruoli?.includes('admin'));
        } else if (!snap.metadata.fromCache) {
          // Reindirizza solo se la risposta viene dal server,
          // non dalla cache locale (evita falsi negativi all'avvio della PWA)
          navigate(`/iscriviti/${getSocietaId()}`, { replace: true });
        }
      }
    );
    return unsubIscrizione;
  }, [societaId]);

  const isActive = (path) => location.pathname === `/${societaId}${path}`;

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

      {/* Header fisso */}
      <header style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #f0f0f0',
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
          overflow: 'hidden', flexShrink: 0,
        }}>
          <img src="https://firebasestorage.googleapis.com/v0/b/fcbachecascherma.firebasestorage.app/o/bacheca_scherma_icon.png?alt=media&token=1e294cb8-eb47-468b-a302-b71de444ec63"
               alt="Bacheca Scherma"
               style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: '#111',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      margin: 0 }}>
            {societa?.nome || '...'}
          </p>
          <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>Bacheca avvisi</p>
        </div>

      </header>

      {/* Schermata attesa approvazione */}
      {statoIscrizione && statoIscrizione !== 'attivo' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>⏳</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#00244F',
                       margin: '0 0 0.5rem' }}>
            In attesa di approvazione
          </h2>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 2rem',
                      maxWidth: 280 }}>
            La tua iscrizione è in attesa di essere approvata dall'amministratore.
            Riceverai una notifica quando verrà abilitata.
          </p>
        </div>
      )}

      {/* Area scrollabile — solo se attivo */}
      {(!statoIscrizione || statoIscrizione === 'attivo') && <main style={{
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
      </main>}

      {/* Bottom nav fissa */}
      <nav style={{
        backgroundColor: '#fff',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        flexShrink: 0,
      }}>
        <NavItem label="Avvisi" active={isActive('')}
          onClick={() => navigate(`/${societaId}`)}
          icon={
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002
                       6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388
                       6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3
                       0 11-6 0v-1m6 0H9" />
            </svg>
          }
        />
        <NavItem label="Profilo" active={isActive('/profilo')}
          onClick={() => navigate(`/${societaId}/profilo`)}
          icon={
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7
                       7 0 00-7-7z" />
            </svg>
          }
        />
        {isAdmin && (
          <NavItem label="Admin" active={location.pathname.startsWith(`/${societaId}/admin`)}
            onClick={() => navigate(`/${societaId}/admin`)}
            icon={
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0
                         002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0
                         001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0
                         00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724
                         0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724
                         1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724
                         1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724
                         1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608
                         2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
        )}
      </nav>
    </div>
  );
}

function NavItem({ label, active, onClick, icon }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4, padding: '0.75rem 0',
      background: 'none', border: 'none', cursor: 'pointer',
      color: active ? '#0179C0' : '#aaa',
      transition: 'color 0.2s',
    }}>
      {icon}
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </button>
  );
}
