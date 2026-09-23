/**
 * Legge il societaId dal sottodominio corrente.
 * Es: brianzascherma.bachecascherma.it → 'brianzascherma'
 * In sviluppo (localhost) usa un fallback hardcodato.
 * Restituisce null se si è sul dominio root (bachecascherma.it).
 */
export function getSocietaId() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'brianzascherma'; // fallback sviluppo
  }
  if (hostname === 'bachecascherma.it' || hostname === 'www.bachecascherma.it') {
    return null;
  }
  return hostname.split('.')[0];
}
