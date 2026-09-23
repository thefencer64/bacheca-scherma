import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utente, setUtente]           = useState(null);
  const [profilo, setProfilo]         = useState(undefined); // undefined = ancora in caricamento
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    // Timeout di sicurezza: se onAuthStateChanged non risponde entro 6s
    // (problema noto su iOS Safari/PWA con IndexedDB bloccata),
    // sblocca comunque il caricamento e manda l'utente al login.
    const timeout = setTimeout(() => {
      setCaricamento(false);
    }, 6000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout);
      try {
        if (firebaseUser) {
          setUtente(firebaseUser);
          const snap = await getDoc(doc(db, 'utenti', firebaseUser.uid));
          if (snap.exists()) {
            setProfilo(snap.data());
          } else {
            // Documento non ancora creato (es. primo accesso Google)
            setProfilo(null);
          }
        } else {
          setUtente(null);
          setProfilo(null);
        }
      } catch (e) {
        console.error('Errore onAuthStateChanged:', e.code, e.message);
        setProfilo(null);
      } finally {
        setCaricamento(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  async function registraConEmail(email, password, datiAnagrafici) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);

    // Cerca se esiste già un documento preRegistrato con questa email
    // tramite Cloud Function (le rules non permettono query list su utenti)
    const functions  = getFunctions(undefined, 'europe-west1');
    const cercaFn    = httpsCallable(functions, 'cercaPreRegistrato');
    const risultato  = await cercaFn({ email }).catch(() => ({ data: { trovato: false } }));

    if (risultato.data.trovato) {
      const { vecchioUid, dati: preData } = risultato.data;

      // Crea il nuovo documento con il vero UID Auth
      await setDoc(doc(db, 'utenti', cred.user.uid), {
        ...preData,
        uid:             cred.user.uid,
        email,
        nome:            preData.nome || datiAnagrafici.nome,
        cognome:         preData.cognome || datiAnagrafici.cognome,
        dataNascita:     preData.dataNascita || datiAnagrafici.dataNascita,
        telefono:        datiAnagrafici.telefono || preData.telefono || '',
        fcmTokens:       [],
        profiloCompleto: true,
        preRegistrato:   false,
        aggiornatoAt:    serverTimestamp(),
      });

      // Collega iscrizioni e relazioni al nuovo UID
      const collegaFn = httpsCallable(functions, 'collegaUtentePreRegistrato');
      await collegaFn({ vecchioUid, nuovoUid: cred.user.uid }).catch(e => {
        console.warn('Collegamento preRegistrato:', e.message);
      });

    } else {
      // Registrazione normale — crea documento nuovo
      await setDoc(doc(db, 'utenti', cred.user.uid), {
        uid:             cred.user.uid,
        email,
        nome:            datiAnagrafici.nome,
        cognome:         datiAnagrafici.cognome,
        dataNascita:     datiAnagrafici.dataNascita,
        telefono:        datiAnagrafici.telefono || '',
        fcmTokens:       [],
        profiloCompleto: true,
        creatoAt:        serverTimestamp(),
      });
    }

    return cred.user;
  }

  async function loginConEmail(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginConGoogle() {
    const provider = new GoogleAuthProvider();
    // Usa redirect invece di popup per evitare problemi COOP in sviluppo
    const cred     = await signInWithPopup(auth, provider);
    const snap     = await getDoc(doc(db, 'utenti', cred.user.uid));

    if (!snap.exists()) {
      // Primo accesso con Google — crea documento base incompleto
      const nomeParts = (cred.user.displayName || '').split(' ');
      await setDoc(doc(db, 'utenti', cred.user.uid), {
        uid:             cred.user.uid,
        email:           cred.user.email,
        nome:            nomeParts[0] || '',
        cognome:         nomeParts.slice(1).join(' ') || '',
        dataNascita:     null,
        telefono:        '',
        fcmTokens:       [],
        profiloCompleto: false,
        creatoAt:        serverTimestamp(),
      });
      setProfilo({ dataNascita: null, profiloCompleto: false });
      return { user: cred.user, profiloCompleto: false };
    }

    const dati = snap.data();
    // Profilo completo se ha la data di nascita
    const completo = !!dati.dataNascita;
    if (!completo && dati.profiloCompleto !== false) {
      // Aggiorna il flag se manca
      await setDoc(doc(db, 'utenti', cred.user.uid),
        { profiloCompleto: false }, { merge: true });
    }
    setProfilo(dati);
    return { user: cred.user, profiloCompleto: completo };
  }

  async function logout() {
    await signOut(auth);
    window.location.href = '/login';
  }

  async function refreshProfilo() {
    if (!utente) return;
    const snap = await getDoc(doc(db, 'utenti', utente.uid));
    if (snap.exists()) setProfilo(snap.data());
  }

  async function isAdmin(societaId) {
    if (!utente || !societaId) return false;
    const snap = await getDoc(
      doc(db, 'societa', societaId, 'iscrizioni', utente.uid)
    );
    return snap.exists()
      && snap.data().ruoli?.includes('admin')
      && snap.data().statoAccount === 'attivo';
  }

  async function isAttivo(societaId) {
    if (!utente || !societaId) return false;
    const snap = await getDoc(
      doc(db, 'societa', societaId, 'iscrizioni', utente.uid)
    );
    return snap.exists() && snap.data().statoAccount === 'attivo';
  }

  return (
    <AuthContext.Provider value={{
      utente,
      profilo,
      caricamento,
      registraConEmail,
      loginConEmail,
      loginConGoogle,
      logout,
      refreshProfilo,
      isAdmin,
      isAttivo,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return ctx;
}
