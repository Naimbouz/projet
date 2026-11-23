// Popola il database con dati di test FITTIZI.
// Nessun dato reale di pazienti, nessun nome/logo di aziende reali.
//
// Uso come script:   npm run seed
// Uso come modulo:    import { popola } from './seed.js'; popola(db);

import { openDb } from './db.js';
import { fileURLToPath } from 'node:url';

// Dati di supporto (costanti, nessun effetto collaterale all'import).
const sedi = [
  { nome: 'SmileFlow Centro',  citta: 'Città',      telefono: '+378 0549 100100' },
  { nome: 'SmileFlow Mare',    citta: 'Serravalle', telefono: '+378 0549 200200' },
  { nome: 'SmileFlow Collina', citta: 'Borgo',      telefono: '+378 0549 300300' },
];
const canali = ['google', 'meta', 'instagram', 'referral', 'diretto'];
const costoPerCanale = { google: 28, meta: 19, instagram: 16, referral: 0, diretto: 0 };
const trattamenti = ['igiene', 'ortodonzia', 'implantologia', 'sbiancamento', 'estetica', 'controllo'];
const statiPossibili = ['nuova', 'contattata', 'in_attesa', 'convertita', 'persa'];
const nomiFittizi = [
  'Mario Rossi', 'Lucia Bianchi', 'Giovanni Verdi', 'Anna Russo', 'Paolo Gallo',
  'Elena Costa', 'Marco Ferrari', 'Sara Conti', 'Luca Greco', 'Chiara Marino',
  'Davide Rizzo', 'Giulia Moretti', 'Andrea Barbieri', 'Francesca Fontana', 'Matteo Serra',
];

/**
 * Svuota e ripopola il database con dati fittizi riproducibili.
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {{ sedi: number, richieste: number, appuntamenti: number }}
 */
export function popola(db) {
  // Pulizia (ordine inverso rispetto alle chiavi esterne).
  db.exec(`
    DELETE FROM promemoria_log;
    DELETE FROM appuntamenti;
    DELETE FROM richieste;
    DELETE FROM sedi;
    DELETE FROM sqlite_sequence WHERE name IN ('sedi','richieste','appuntamenti','promemoria_log');
  `);

  const insSede = db.prepare('INSERT INTO sedi (nome, citta, telefono) VALUES (?, ?, ?)');
  for (const s of sedi) insSede.run(s.nome, s.citta, s.telefono);

  // Generatore pseudo-casuale deterministico (seed riproducibile).
  let seme = 42;
  const rnd = () => {
    seme = (seme * 1103515245 + 12345) & 0x7fffffff;
    return seme / 0x7fffffff;
  };
  const scegli = (arr) => arr[Math.floor(rnd() * arr.length)];
  const isoGiorniFa = (giorni) =>
    new Date(Date.now() - giorni * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const isoOreDaOra = (ore) =>
    new Date(Date.now() + ore * 3600000).toISOString().slice(0, 19).replace('T', ' ');

  const insRichiesta = db.prepare(`
    INSERT INTO richieste (nome, telefono, email, sede_id, canale, trattamento, stato, costo_acquisizione, creata_il)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const richiesteCreate = [];
  for (let i = 0; i < 45; i++) {
    const nome = scegli(nomiFittizi);
    const telefono = '+378 333 ' + String(1000000 + Math.floor(rnd() * 8999999)).slice(0, 7);
    const email = nome.toLowerCase().replace(' ', '.') + i + '@example.test';
    const sede_id = 1 + Math.floor(rnd() * sedi.length);
    const canale = scegli(canali);
    const trattamento = scegli(trattamenti);
    const stato = scegli(statiPossibili);
    const creata_il = isoGiorniFa(Math.floor(rnd() * 25));
    const info = insRichiesta.run(nome, telefono, email, sede_id, canale, trattamento, stato, costoPerCanale[canale], creata_il);
    richiesteCreate.push({ id: Number(info.lastInsertRowid), sede_id, stato });
  }

  const insApp = db.prepare(`
    INSERT INTO appuntamenti (richiesta_id, sede_id, data_ora, stato, promemoria_inviato)
    VALUES (?, ?, ?, ?, 0)
  `);
  const offsetOre = [5, 20, 30, 47, 72, -24, -72];
  richiesteCreate
    .filter((r) => r.stato === 'convertita')
    .forEach((r, idx) => {
      const ore = offsetOre[idx % offsetOre.length];
      insApp.run(r.id, r.sede_id, isoOreDaOra(ore), ore < 0 ? 'completato' : 'programmato');
    });

  return {
    sedi: db.prepare('SELECT COUNT(*) c FROM sedi').get().c,
    richieste: db.prepare('SELECT COUNT(*) c FROM richieste').get().c,
    appuntamenti: db.prepare('SELECT COUNT(*) c FROM appuntamenti').get().c,
  };
}

// Esecuzione come script: `npm run seed`.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb();
  const r = popola(db);
  console.log(`Seed completato: ${r.sedi} sedi, ${r.richieste} richieste, ${r.appuntamenti} appuntamenti.`);
  db.close();
}
