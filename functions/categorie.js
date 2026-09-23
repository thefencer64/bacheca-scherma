/**
 * categorie.js
 * Logica categorie FIS — condivisa tra Cloud Functions e client React.
 * Nessuna dipendenza da Firebase.
 */

/**
 * Calcola la categoria principale dell'atleta dalla data di nascita.
 * @param {Array}  categorie   - da configCategorie/corrente
 * @param {string} dataNascita - "YYYY-MM-DD"
 * @returns {string|null}
 */
function calcolaCategoria(categorie, dataNascita) {
  if (!dataNascita) return null;
  const anno = parseInt(dataNascita.substring(0, 4), 10);
  const data = new Date(dataNascita);

  for (const cat of categorie) {
    if (cat.anniNascita && cat.anniNascita.includes(anno)) return cat.id;
  }

  const conRange = categorie
    .filter(c => c.dataNascitaDal || c.dataNascitaAl)
    .sort((a, b) => a.ordine - b.ordine);

  for (const cat of conRange) {
    const dal = cat.dataNascitaDal ? new Date(cat.dataNascitaDal) : null;
    const al  = cat.dataNascitaAl  ? new Date(cat.dataNascitaAl)  : null;
    if ((!dal || data >= dal) && (!al || data <= al)) return cat.id;
  }
  return null;
}

/**
 * Restituisce tutte le categorie dell'atleta (es. Master + Assoluti).
 */
function categoriePerNascita(categorie, dataNascita) {
  if (!dataNascita) return [];
  const anno = parseInt(dataNascita.substring(0, 4), 10);
  const data = new Date(dataNascita);
  const out  = [];

  for (const cat of categorie) {
    if (cat.anniNascita && cat.anniNascita.includes(anno)) {
      out.push(cat.id);
      continue;
    }
    if (cat.dataNascitaDal || cat.dataNascitaAl) {
      const dal = cat.dataNascitaDal ? new Date(cat.dataNascitaDal) : null;
      const al  = cat.dataNascitaAl  ? new Date(cat.dataNascitaAl)  : null;
      if ((!dal || data >= dal) && (!al || data <= al)) out.push(cat.id);
    }
  }
  return out;
}

/**
 * Costruisce preferenzeNotifiche.proprie per un atleta.
 */
function buildPreferenzeProprie(categorie, dataNascita, extra = [], tutteLeCategorie = false) {
  const calcolate = categoriePerNascita(categorie, dataNascita);
  const unite     = [...new Set(['generale', ...calcolate, ...extra])];
  return {
    tutteLeCategorie,
    categorieIds: tutteLeCategorie ? [] : unite,
    generale: true,
  };
}

/**
 * Costruisce preferenzeNotifiche.perFigli per un genitore.
 * Unisce le categorie di tutti i figli attivi sulla stessa società.
 * @param {string[][]} categorieIdsFigli - array di categorieIds per ogni figlio
 * @param {string[]}   extra
 * @param {boolean}    tutteLeCategorie
 */
function buildPreferenzePerFigli(categorieIdsFigli, extra = [], tutteLeCategorie = false) {
  const unite = [...new Set(['generale', ...categorieIdsFigli.flat(), ...extra])];
  return {
    tutteLeCategorie,
    categorieIds: tutteLeCategorie ? [] : unite,
    generale: true,
  };
}

/**
 * Unisce proprie e perFigli per determinare le categorie effettive
 * a cui un utente è interessato (usato per filtrare i destinatari push).
 * @param {object} preferenzeNotifiche - da iscrizioni/{uid}
 * @returns {object} { tutteLeCategorie, categorieIds, generale }
 */
function preferenzeEffettive(preferenzeNotifiche) {
  const proprie  = preferenzeNotifiche.proprie  || {};
  const perFigli = preferenzeNotifiche.perFigli || {};

  if (proprie.tutteLeCategorie || perFigli.tutteLeCategorie) {
    return { tutteLeCategorie: true, categorieIds: [], generale: true };
  }

  const ids = [...new Set([
    ...(proprie.categorieIds  || []),
    ...(perFigli.categorieIds || []),
  ])];

  return {
    tutteLeCategorie: false,
    categorieIds: ids,
    generale: (proprie.generale !== false) || (perFigli.generale !== false),
  };
}

/**
 * Stabilisce se un utente deve ricevere la push per un dato avviso.
 * @param {object}   preferenzeNotifiche - da iscrizioni/{uid}
 * @param {string[]} categorieTarget     - da avvisi/{id}
 */
function deveRicevere(preferenzeNotifiche, categorieTarget) {
  const eff = preferenzeEffettive(preferenzeNotifiche);

  // Avviso generale (nessun target) → tutti gli attivi con generale=true
  if (!categorieTarget || categorieTarget.length === 0) {
    return eff.generale !== false;
  }

  if (eff.tutteLeCategorie) return true;

  const mie = new Set(eff.categorieIds);
  return categorieTarget.some(id => mie.has(id));
}

/**
 * Costruisce l'array completo delle categorie FIS per una stagione.
 * @param {string} stagione - "YYYY-YYYY" (es. "2026-2027")
 * @returns {Array|null}
 */
function buildCategoriePerStagione(stagione) {
  const annoRef = parseInt(stagione.split('-')[0], 10);
  if (isNaN(annoRef)) return null;

  const y = (offset) => String(annoRef + offset);
  const d = (anno, mese, giorno) => `${anno}-${mese}-${giorno}`;

  return [
    { id: 'generale',     etichetta: 'Avvisi generali',               anniNascita: [], isMaster: false, sottocategoria: null, dataNascitaDal: null,              dataNascitaAl: null,              ordine: 0  },
    { id: 'minions',      etichetta: 'Minions',                       anniNascita: [], isMaster: false, isSpeciale: false, sottocategoria: null, dataNascitaDal: d(y(-9),'01','01'),  dataNascitaAl: null,              ordine: 0  },
    { id: 'bambini',      etichetta: 'Bambine / Maschietti',          anniNascita: [annoRef - 10], isMaster: false, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 1  },
    { id: 'giovanissimi', etichetta: 'Giovanissime / Giovanissimi',   anniNascita: [annoRef - 11], isMaster: false, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 2  },
    { id: 'ragazzi',      etichetta: 'Ragazze / Ragazzi',             anniNascita: [annoRef - 12], isMaster: false, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 3  },
    { id: 'allievi',      etichetta: 'Allieve / Allievi',             anniNascita: [annoRef - 13], isMaster: false, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 4  },
    { id: 'cadetti',      etichetta: 'Cadetti (M/F)',                 anniNascita: [], isMaster: false, sottocategoria: null, dataNascitaDal: d(y(-16),'01','01'), dataNascitaAl: d(y(-14),'12','31'), ordine: 5  },
    { id: 'giovani',      etichetta: 'Giovani (M/F)',                 anniNascita: [], isMaster: false, sottocategoria: null, dataNascitaDal: d(y(-19),'01','01'), dataNascitaAl: d(y(-17),'12','31'), ordine: 6  },
    { id: 'under23',      etichetta: 'Under 23',                      anniNascita: [], isMaster: false, sottocategoria: null, dataNascitaDal: d(y(-22),'01','01'), dataNascitaAl: d(y(-20),'12','31'), ordine: 7  },
    { id: 'assoluti',     etichetta: 'Assoluti',                      anniNascita: [], isMaster: false, sottocategoria: null, dataNascitaDal: d(y(-22),'01','01'), dataNascitaAl: d(y(-14),'12','31'), ordine: 13 },
    { id: 'master_0',     etichetta: 'Master — Cat. 0 (over 24)',     anniNascita: [], isMaster: true,  sottocategoria: '0', dataNascitaDal: d(y(-38),'01','01'), dataNascitaAl: d(y(-23),'12','31'), ordine: 13 },
    { id: 'master_1',     etichetta: 'Master — Cat. 1 (over 40)',     anniNascita: [], isMaster: true,  sottocategoria: '1', dataNascitaDal: d(y(-48),'01','01'), dataNascitaAl: d(y(-39),'12','31'), ordine: 13 },
    { id: 'master_2',     etichetta: 'Master — Cat. 2 (over 50)',     anniNascita: [], isMaster: true,  sottocategoria: '2', dataNascitaDal: d(y(-58),'01','01'), dataNascitaAl: d(y(-49),'12','31'), ordine: 13 },
    { id: 'master_3',     etichetta: 'Master — Cat. 3 (over 60)',     anniNascita: [], isMaster: true,  sottocategoria: '3', dataNascitaDal: d(y(-68),'01','01'), dataNascitaAl: d(y(-59),'12','31'), ordine: 13 },
    { id: 'master_4',     etichetta: 'Master — Cat. 4 (over 70)',     anniNascita: [], isMaster: true,  sottocategoria: '4', dataNascitaDal: null,              dataNascitaAl: d(y(-69),'12','31'), ordine: 13 },
    { id: 'paralimpico',  etichetta: 'Paralimpico',                   anniNascita: [], isMaster: false, isSpeciale: true, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 13 },
    { id: 'integrata',    etichetta: 'Scherma Integrata',             anniNascita: [], isMaster: false, isSpeciale: true, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 14 },
    { id: 'non_vedenti',  etichetta: 'Non Vedenti',                   anniNascita: [], isMaster: false, isSpeciale: true, sottocategoria: null, dataNascitaDal: null, dataNascitaAl: null, ordine: 15 },
  ];
}

module.exports = {
  calcolaCategoria,
  categoriePerNascita,
  buildPreferenzeProprie,
  buildPreferenzePerFigli,
  buildCategoriePerStagione,
  preferenzeEffettive,
  deveRicevere,
};
