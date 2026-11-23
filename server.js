// SmileFlow - server Express + API REST.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './db.js';
import { popola } from './seed.js';
import {
  validaRichiesta, validaStatoRichiesta,
  validaAppuntamento, validaStatoAppuntamento,
} from './validation.js';
import { tuttiGliStats } from './stats.js';
import { eseguiPromemoria } from './reminders.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = openDb();

// Su un hosting con disco effimero il database riparte vuoto a ogni riavvio.
// Se non ci sono sedi, inseriamo automaticamente i dati di esempio (demo).
if (db.prepare('SELECT COUNT(*) AS c FROM sedi').get().c === 0) {
  const r = popola(db);
  console.log(`Database vuoto: inseriti dati di esempio (${r.richieste} richieste).`);
}

const app = express();
app.use(express.json());                                   // legge i corpi JSON
app.use(express.static(join(__dirname, 'public')));        // serve il front-end

// Converte il filtro "periodo" (giorni) in una clausola SQL sicura.
// Restituisce null se il periodo non è valido/assente (nessun filtro temporale).
function periodoToDate(periodo) {
  const giorni = Number(periodo);
  if (!Number.isInteger(giorni) || giorni <= 0) return null;
  return `-${giorni} days`;
}

// Costruisce la clausola WHERE per i filtri delle richieste.
// Usata sia dall'elenco JSON sia dall'esportazione CSV (una sola fonte di verità).
function filtriRichieste(query) {
  const condizioni = [];
  const parametri = [];

  if (query.sede) {
    condizioni.push('r.sede_id = ?');
    parametri.push(Number(query.sede));
  }
  const periodo = periodoToDate(query.periodo);
  if (periodo) {
    condizioni.push("r.creata_il >= datetime('now', ?)");
    parametri.push(periodo);
  }
  if (query.canale) {
    condizioni.push('r.canale = ?');
    parametri.push(query.canale);
  }
  if (query.stato) {
    condizioni.push('r.stato = ?');
    parametri.push(query.stato);
  }
  if (query.q && String(query.q).trim() !== '') {
    // Ricerca testuale su nome o telefono.
    condizioni.push('(r.nome LIKE ? OR r.telefono LIKE ?)');
    const like = `%${String(query.q).trim()}%`;
    parametri.push(like, like);
  }

  const where = condizioni.length ? `WHERE ${condizioni.join(' AND ')}` : '';
  return { where, parametri };
}

// --- SEDI ------------------------------------------------------------------

// GET /api/sedi : elenco delle sedi (per i menu a tendina del front-end).
app.get('/api/sedi', (req, res) => {
  res.json(db.prepare('SELECT * FROM sedi ORDER BY nome').all());
});

// --- RICHIESTE -------------------------------------------------------------

// POST /api/richieste : registra una nuova richiesta di contatto.
app.post('/api/richieste', (req, res) => {
  const { errors, value } = validaRichiesta(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  // Verifichiamo che la sede esista (coerenza con la chiave esterna).
  const sede = db.prepare('SELECT id FROM sedi WHERE id = ?').get(value.sede_id);
  if (!sede) {
    return res.status(400).json({ errors: ['sede_id: sede inesistente'] });
  }
  const info = db
    .prepare(
      `INSERT INTO richieste (nome, telefono, email, sede_id, canale, trattamento, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(value.nome, value.telefono, value.email, value.sede_id, value.canale, value.trattamento, value.note);
  const creata = db.prepare('SELECT * FROM richieste WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(creata);
});

// GET /api/richieste : elenco con filtri (sede, periodo, canale, stato, q).
app.get('/api/richieste', (req, res) => {
  const { where, parametri } = filtriRichieste(req.query);
  const righe = db
    .prepare(
      `SELECT r.*, s.nome AS sede_nome
       FROM richieste r
       JOIN sedi s ON s.id = r.sede_id
       ${where}
       ORDER BY r.creata_il DESC`
    )
    .all(...parametri);
  res.json(righe);
});

// GET /api/richieste/export.csv : esporta le richieste filtrate in CSV.
app.get('/api/richieste/export.csv', (req, res) => {
  const { where, parametri } = filtriRichieste(req.query);
  const righe = db
    .prepare(
      `SELECT r.id, r.nome, r.telefono, r.email, s.nome AS sede,
              r.canale, r.trattamento, r.stato, r.costo_acquisizione, r.creata_il
       FROM richieste r
       JOIN sedi s ON s.id = r.sede_id
       ${where}
       ORDER BY r.creata_il DESC`
    )
    .all(...parametri);

  const colonne = ['id', 'nome', 'telefono', 'email', 'sede', 'canale', 'trattamento', 'stato', 'costo_acquisizione', 'creata_il'];
  // Racchiude ogni campo tra virgolette e raddoppia le virgolette interne (CSV standard).
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const righeCsv = righe.map((r) => colonne.map((c) => esc(r[c])).join(','));
  const csv = [colonne.join(','), ...righeCsv].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="richieste.csv"');
  res.send('﻿' + csv); // BOM per far aprire bene gli accenti in Excel
});

// PATCH /api/richieste/:id : aggiorna lo stato di una richiesta.
app.patch('/api/richieste/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ errors: ['id: non valido'] });
  }
  const { errors, value } = validaStatoRichiesta(req.body?.stato);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  const info = db.prepare('UPDATE richieste SET stato = ? WHERE id = ?').run(value, id);
  if (info.changes === 0) {
    return res.status(404).json({ errors: ['richiesta non trovata'] });
  }
  res.json(db.prepare('SELECT * FROM richieste WHERE id = ?').get(id));
});

// --- STATISTICHE / KPI -----------------------------------------------------

// GET /api/stats : indicatori calcolati con query SQL reali.
app.get('/api/stats', (req, res) => {
  res.json(tuttiGliStats(db));
});

// --- APPUNTAMENTI E PROMEMORIA ---------------------------------------------

// GET /api/appuntamenti : elenco appuntamenti con i dati del paziente e della sede.
// Filtro opzionale "entro_ore": solo quelli futuri entro N ore.
app.get('/api/appuntamenti', (req, res) => {
  const condizioni = ["a.stato IN ('programmato', 'confermato', 'completato', 'annullato')"];
  const parametri = [];

  const entroOre = Number(req.query.entro_ore);
  if (Number.isInteger(entroOre) && entroOre > 0) {
    condizioni.push("a.data_ora > datetime('now') AND a.data_ora <= datetime('now', ?)");
    parametri.push(`+${entroOre} hours`);
  }

  const righe = db
    .prepare(
      `SELECT a.id, a.data_ora, a.stato, a.promemoria_inviato,
              r.nome, r.telefono, r.email,
              s.nome AS sede_nome
       FROM appuntamenti a
       JOIN richieste r ON r.id = a.richiesta_id
       JOIN sedi s      ON s.id = a.sede_id
       WHERE ${condizioni.join(' AND ')}
       ORDER BY a.data_ora ASC`
    )
    .all(...parametri);
  res.json(righe);
});

// POST /api/appuntamenti : fissa un appuntamento a partire da una richiesta.
// Imposta anche la richiesta come "convertita" (chiude il funnel).
app.post('/api/appuntamenti', (req, res) => {
  const { errors, value } = validaAppuntamento(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  const richiesta = db.prepare('SELECT id, sede_id FROM richieste WHERE id = ?').get(value.richiesta_id);
  if (!richiesta) {
    return res.status(400).json({ errors: ['richiesta_id: richiesta inesistente'] });
  }

  // La sede dell'appuntamento è quella della richiesta (coerenza dei dati).
  const info = db
    .prepare('INSERT INTO appuntamenti (richiesta_id, sede_id, data_ora) VALUES (?, ?, ?)')
    .run(richiesta.id, richiesta.sede_id, value.data_ora);
  db.prepare("UPDATE richieste SET stato = 'convertita' WHERE id = ?").run(richiesta.id);

  const creato = db
    .prepare(
      `SELECT a.*, r.nome, r.telefono, s.nome AS sede_nome
       FROM appuntamenti a
       JOIN richieste r ON r.id = a.richiesta_id
       JOIN sedi s      ON s.id = a.sede_id
       WHERE a.id = ?`
    )
    .get(info.lastInsertRowid);
  res.status(201).json(creato);
});

// PATCH /api/appuntamenti/:id : aggiorna lo stato dell'appuntamento.
app.patch('/api/appuntamenti/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ errors: ['id: non valido'] });
  }
  const { errors, value } = validaStatoAppuntamento(req.body?.stato);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  const info = db.prepare('UPDATE appuntamenti SET stato = ? WHERE id = ?').run(value, id);
  if (info.changes === 0) {
    return res.status(404).json({ errors: ['appuntamento non trovato'] });
  }
  res.json(db.prepare('SELECT * FROM appuntamenti WHERE id = ?').get(id));
});

// POST /api/promemoria/esegui : lancia l'automazione dei promemoria.
// Corpo: { ore_prima?: number, canale?: 'whatsapp'|'sms'|'email' }
app.post('/api/promemoria/esegui', async (req, res) => {
  try {
    const risultato = await eseguiPromemoria(db, {
      orePrima: req.body?.ore_prima ?? 24,
      canale: req.body?.canale ?? 'whatsapp',
    });
    res.json(risultato);
  } catch (e) {
    res.status(400).json({ errors: [e.message] });
  }
});

// --- Avvio del server ------------------------------------------------------
const PORT = process.env.PORT || 3000;

// Avviamo il server solo se il file è eseguito direttamente (non durante i test).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`SmileFlow in ascolto su http://localhost:${PORT}`);
  });
}

export { app, db };
