// Popola il database con dati di test FITTIZI.
// Nessun dato reale di pazienti, nessun nome/logo di aziende reali.
// Uso: npm run seed

import { openDb } from './db.js';

const db = openDb();

// --- Pulizia (ordine inverso rispetto alle chiavi esterne) ---
db.exec(`
  DELETE FROM promemoria_log;
  DELETE FROM appuntamenti;
  DELETE FROM richieste;
  DELETE FROM sedi;
  DELETE FROM sqlite_sequence WHERE name IN ('sedi','richieste','appuntamenti','promemoria_log');
`);

// --- Sedi (nomi e luoghi inventati) ---
const sedi = [
  { nome: 'SmileFlow Centro',  citta: 'Città',      telefono: '+378 0549 100100' },
  { nome: 'SmileFlow Mare',    citta: 'Serravalle', telefono: '+378 0549 200200' },
  { nome: 'SmileFlow Collina', citta: 'Borgo',      telefono: '+378 0549 300300' },
];
const insSede = db.prepare('INSERT INTO sedi (nome, citta, telefono) VALUES (?, ?, ?)');
for (const s of sedi) insSede.run(s.nome, s.citta, s.telefono);

// --- Dati di supporto per generare richieste varie ---
const canali = ['google', 'meta', 'instagram', 'referral', 'diretto'];
// Costo per lead indicativo per canale (i canali organici costano 0).
const costoPerCanale = { google: 28, meta: 19, instagram: 16, referral: 0, diretto: 0 };
const trattamenti = ['igiene', 'ortodonzia', 'implantologia', 'sbiancamento', 'estetica', 'controllo'];
const nomiFittizi = [
  'Mario Rossi', 'Lucia Bianchi', 'Giovanni Verdi', 'Anna Russo', 'Paolo Gallo',
  'Elena Costa', 'Marco Ferrari', 'Sara Conti', 'Luca Greco', 'Chiara Marino',
  'Davide Rizzo', 'Giulia Moretti', 'Andrea Barbieri', 'Francesca Fontana', 'Matteo Serra',
];

// Piccolo generatore pseudo-casuale deterministico (così il seed è riproducibile).
let seme = 42;
const rnd = () => {
  seme = (seme * 1103515245 + 12345) & 0x7fffffff;
  return seme / 0x7fffffff;
};
const scegli = (arr) => arr[Math.floor(rnd() * arr.length)];
const isoGiorniFa = (giorni) => {
  const d = new Date(Date.now() - giorni * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};
const isoOreDaOra = (ore) => {
  const d = new Date(Date.now() + ore * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

// --- Richieste ---
const insRichiesta = db.prepare(`
  INSERT INTO richieste (nome, telefono, email, sede_id, canale, trattamento, stato, costo_acquisizione, creata_il)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const statiPossibili = ['nuova', 'contattata', 'in_attesa', 'convertita', 'persa'];
const richiesteCreate = []; // { id, sede_id, nome, telefono, email, stato }

for (let i = 0; i < 45; i++) {
  const nome = scegli(nomiFittizi);
  const telefono = '+378 333 ' + String(1000000 + Math.floor(rnd() * 8999999)).slice(0, 7);
  const email = nome.toLowerCase().replace(' ', '.') + i + '@example.test';
  const sede_id = 1 + Math.floor(rnd() * sedi.length);
  const canale = scegli(canali);
  const trattamento = scegli(trattamenti);
  const stato = scegli(statiPossibili);
  const costo = costoPerCanale[canale];
  // Richieste distribuite negli ultimi 25 giorni (alcune vecchie > 2 giorni).
  const creata_il = isoGiorniFa(Math.floor(rnd() * 25));
  const info = insRichiesta.run(nome, telefono, email, sede_id, canale, trattamento, stato, costo, creata_il);
  richiesteCreate.push({ id: Number(info.lastInsertRowid), sede_id, nome, telefono, email, stato });
}

// --- Appuntamenti ---
// Fissiamo un appuntamento per le richieste "convertite", più qualche altro.
const insApp = db.prepare(`
  INSERT INTO appuntamenti (richiesta_id, sede_id, data_ora, stato, promemoria_inviato)
  VALUES (?, ?, ?, ?, ?)
`);

const convertite = richiesteCreate.filter((r) => r.stato === 'convertita');
// Orari pensati per testare i promemoria: alcuni entro 24h, altri entro 48h, alcuni passati.
const offsetOre = [5, 20, 30, 47, 72, -24, -72];
convertite.forEach((r, idx) => {
  const ore = offsetOre[idx % offsetOre.length];
  const data_ora = isoOreDaOra(ore);
  // Gli appuntamenti passati risultano completati, i futuri programmati.
  const stato = ore < 0 ? 'completato' : 'programmato';
  insApp.run(r.id, r.sede_id, data_ora, stato, 0);
});

const totSedi = db.prepare('SELECT COUNT(*) c FROM sedi').get().c;
const totRich = db.prepare('SELECT COUNT(*) c FROM richieste').get().c;
const totApp = db.prepare('SELECT COUNT(*) c FROM appuntamenti').get().c;
console.log(`Seed completato: ${totSedi} sedi, ${totRich} richieste, ${totApp} appuntamenti.`);

db.close();
