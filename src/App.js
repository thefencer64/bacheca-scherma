import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './hooks/useAuth';
import { getSocietaId } from './lib/getSocietaId';
import LandingPage from './pages/LandingPage';

// Pagine pubbliche
import Login           from './pages/auth/Login';
import Registrazione   from './pages/auth/Registrazione';
import Iscrizione      from './pages/auth/Iscrizione';
import StatoIscrizione from './pages/auth/StatoIscrizione';
import CompletaProfilo from './pages/auth/CompletaProfilo';

// Pagine utente
import Bacheca         from './pages/bacheca/Bacheca';
import Avviso          from './pages/bacheca/Avviso';
import Profilo         from './pages/bacheca/Profilo';
import AggiungiFiglio  from './pages/bacheca/AggiungiFiglio';

// Pagine admin
import AdminDashboard   from './pages/admin/Dashboard';
import AdminIscritti    from './pages/admin/Iscritti';
import AdminAvvisi      from './pages/admin/Avvisi';
import AdminNuovoAvviso    from './pages/admin/NuovoAvviso';
import AdminModificaAvviso from './pages/admin/ModificaAvviso';
import AdminRinnovo        from './pages/admin/Rinnovo';
import AdminModificaIscritto from './pages/admin/ModificaIscritto';
import AdminCategorie        from './pages/admin/Categorie';
import AdminMessaggio        from './pages/admin/MessaggioIscritti';

// Layout
import LayoutUtente from './components/ui/LayoutUtente';
import LayoutAdmin  from './components/ui/LayoutAdmin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

function PrivateRoute({ children }) {
  const { utente, caricamento } = useAuth();
  if (caricamento) return <SchermataCaricamento />;
  if (!utente) return <Navigate to="/login" replace />;
  return children;
}

function SchermataCaricamento() {
  return <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }} />;
}

function App() {
  if (getSocietaId() === null) return <LandingPage />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Pubbliche */}
            <Route path="/login"           element={<Login />} />
            <Route path="/registrazione"   element={<Registrazione />} />

            {/* Semi-protette (richiedono auth) */}
            <Route path="/iscriviti/:societaId" element={
              <PrivateRoute><Iscrizione /></PrivateRoute>
            } />
            <Route path="/stato-iscrizione/:societaId" element={
              <PrivateRoute><StatoIscrizione /></PrivateRoute>
            } />
            <Route path="/completa-profilo" element={
              <PrivateRoute><CompletaProfilo /></PrivateRoute>
            } />

            {/* Utente — bacheca */}
            <Route path="/:societaId" element={
              <PrivateRoute><LayoutUtente /></PrivateRoute>
            }>
              <Route index             element={<Bacheca />} />
              <Route path="avviso/:id" element={<Avviso />} />
              <Route path="profilo"    element={<Profilo />} />
              <Route path="aggiungi-figlio" element={<AggiungiFiglio />} />
            </Route>

            {/* Admin */}
            <Route path="/:societaId/admin" element={
              <PrivateRoute><LayoutAdmin /></PrivateRoute>
            }>
              <Route index               element={<AdminDashboard />} />
              <Route path="iscritti"     element={<AdminIscritti />} />
              <Route path="avvisi"       element={<AdminAvvisi />} />
              <Route path="avvisi/nuovo"             element={<AdminNuovoAvviso />} />
              <Route path="avvisi/:id/modifica"     element={<AdminModificaAvviso />} />
              <Route path="rinnovo"      element={<AdminRinnovo />} />
              <Route path="iscritti/:uid/modifica" element={<AdminModificaIscritto />} />
              <Route path="categorie"    element={<AdminCategorie />} />
              <Route path="messaggio"   element={<AdminMessaggio />} />
            </Route>

            {/* Default */}
            <Route path="/" element={<Navigate to={`/${getSocietaId()}`} replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
