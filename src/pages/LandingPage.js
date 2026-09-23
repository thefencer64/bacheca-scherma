import React from 'react';

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      paddingTop: 'env(safe-area-inset-top)',
    }}>

      {/* Logo */}
      <img
        src="https://firebasestorage.googleapis.com/v0/b/fcbachecascherma.firebasestorage.app/o/bacheca_scherma_icon.png?alt=media&token=1e294cb8-eb47-468b-a302-b71de444ec63"
        alt="Bacheca Scherma"
        style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'cover', marginBottom: '1.5rem' }}
      />

      {/* Titolo */}
      <h1 style={{
        fontSize: 28, fontWeight: 700, color: '#00244F',
        margin: '0 0 0.5rem', textAlign: 'center',
      }}>
        Bacheca Scherma
      </h1>
      <p style={{
        fontSize: 15, color: '#888', margin: '0 0 2.5rem',
        textAlign: 'center', maxWidth: 320,
      }}>
        La bacheca avvisi per le società di scherma
      </p>

      {/* Card */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: 20,
        border: '1px solid #f0f0f0',
        padding: '1.5rem',
        maxWidth: 360,
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: '1rem' }}>🔗</div>
        <p style={{ fontSize: 15, color: '#374151', margin: '0 0 0.5rem', fontWeight: 600 }}>
          Accedi tramite la tua società
        </p>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0, lineHeight: 1.6 }}>
          Per accedere all'app utilizza il link fornito
          dalla tua società di scherma.
          <br />
          Il link ha la forma:
        </p>
        <p style={{
          fontSize: 13, color: '#0179C0', margin: '0.75rem 0 0',
          fontFamily: 'monospace', backgroundColor: '#f0f8ff',
          borderRadius: 8, padding: '0.5rem 0.75rem',
          display: 'inline-block',
        }}>
          nomesocieta.bachecascherma.it
        </p>
      </div>

      {/* Footer */}
      <p style={{ fontSize: 12, color: '#D1D5DB', marginTop: '2rem' }}>
        © {new Date().getFullYear()} Bacheca Scherma
      </p>

    </div>
  );
}
