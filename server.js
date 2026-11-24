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
import { eseguiPromemoria, programmaPromemoria, processaProgrammati } from './reminders.js';
import { disponibilitaPerGiorno, slotValido } from './availability.js';
import { TRATTAMENTI } from './validation.js';

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
  const condizioni = [];
  const parametri = [];

  // da_avvisare=1 : solo gli appuntamenti idonei a un promemoria.
  if (req.query.da_avvisare === '1') {
    condizioni.push("a.promemoria_inviato = 0 AND a.stato IN ('programmato','confermato') AND a.data_ora > datetime('now')");
  } else {
    condizioni.push("a.stato IN ('programmato', 'confermato', 'completato', 'annullato')");
  }

  if (req.query.sede) {
    condizioni.push('a.sede_id = ?');
    parametri.push(Number(req.query.sede));
  }

  if (req.query.q && String(req.query.q).trim() !== '') {
    condizioni.push('r.nome LIKE ?');
    parametri.push(`%${String(req.query.q).trim()}%`);
  }

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
      ids: req.body?.ids ?? null,
    });
    res.json(risultato);
  } catch (e) {
    res.status(400).json({ errors: [e.message] });
  }
});

// POST /api/promemoria/programma : programma l'invio a una data/ora futura.
// Corpo: { ids: number[], canale, invia_il: "YYYY-MM-DD HH:MM" }
app.post('/api/promemoria/programma', (req, res) => {
  try {
    const risultato = programmaPromemoria(db, {
      ids: req.body?.ids ?? [],
      canale: req.body?.canale ?? 'whatsapp',
      inviaIl: req.body?.invia_il,
    });
    res.json(risultato);
  } catch (e) {
    res.status(400).json({ errors: [e.message] });
  }
});

// GET /api/promemoria/programmati : elenco dei promemoria ancora in attesa.
app.get('/api/promemoria/programmati', (req, res) => {
  const righe = db
    .prepare(
      `SELECT p.id, p.invia_il, p.canale, p.stato,
              a.data_ora, r.nome, s.nome AS sede_nome
       FROM promemoria_programmati p
       JOIN appuntamenti a ON a.id = p.appuntamento_id
       JOIN richieste r    ON r.id = a.richiesta_id
       JOIN sedi s         ON s.id = a.sede_id
       WHERE p.stato = 'in_attesa'
       ORDER BY p.invia_il ASC`
    )
    .all();
  res.json(righe);
});

// --- PRENOTAZIONE ONLINE (lato cliente) ------------------------------------

// GET /api/disponibilita?sede=ID : slot dei prossimi giorni, con stato
// 'libero' / 'occupato'. Gli occupati sono gli appuntamenti non annullati.
app.get('/api/disponibilita', (req, res) => {
  const sedeId = Number(req.query.sede);
  if (!Number.isInteger(sedeId) || sedeId <= 0) {
    return res.status(400).json({ errors: ['sede: intero positivo obbligatorio'] });
  }
  const sede = db.prepare('SELECT id, nome FROM sedi WHERE id = ?').get(sedeId);
  if (!sede) {
    return res.status(400).json({ errors: ['sede: sede inesistente'] });
  }

  // Chiavi "YYYY-MM-DD HH:MM" già occupate per questa sede (no annullati).
  const righe = db
    .prepare(
      `SELECT substr(data_ora, 1, 16) AS k
       FROM appuntamenti
       WHERE sede_id = ? AND stato != 'annullato'
         AND data_ora >= datetime('now', 'start of day')`
    )
    .all(sedeId);
  const occupati = new Set(righe.map((r) => r.k));

  res.json({
    sede: { id: sede.id, nome: sede.nome },
    giorni: disponibilitaPerGiorno(occupati),
  });
});

// POST /api/prenota : il cliente sceglie uno slot libero e conferma.
// Corpo: { sede_id, data_ora:"YYYY-MM-DD HH:MM", nome, telefono, email?, trattamento? }
// Crea la richiesta (canale 'diretto') e l'appuntamento (stato 'programmato').
app.post('/api/prenota', (req, res) => {
  const b = req.body || {};

  const errors = [];
  if (typeof b.nome !== 'string' || b.nome.trim() === '') errors.push('nome: obbligatorio');
  else if (b.nome.trim().length > 100) errors.push('nome: massimo 100 caratteri');
  if (typeof b.telefono !== 'string' || !/^[0-9+().\s-]{6,25}$/.test(b.telefono.trim())) {
    errors.push('telefono: formato non valido');
  }
  const sedeId = Number(b.sede_id);
  if (!Number.isInteger(sedeId) || sedeId <= 0) errors.push('sede_id: obbligatorio');
  const trattamento = b.trattamento;
  if (!TRATTAMENTI.includes(trattamento)) errors.push('trattamento: obbligatorio');
  if (typeof b.email !== 'string' || b.email.trim() === '') {
    errors.push('email: obbligatoria');
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email.trim())) {
    errors.push('email: formato non valido');
  }
  // La chiave slot "YYYY-MM-DD HH:MM" deve essere uno slot valido e futuro.
  const chiave = typeof b.data_ora === 'string' ? b.data_ora.slice(0, 16) : '';
  if (!slotValido(chiave)) errors.push('data_ora: slot non valido o non più disponibile');

  if (errors.length > 0) return res.status(400).json({ errors });

  const sede = db.prepare('SELECT id, nome FROM sedi WHERE id = ?').get(sedeId);
  if (!sede) return res.status(400).json({ errors: ['sede_id: sede inesistente'] });

  const dataOraFull = `${chiave}:00`; // "YYYY-MM-DD HH:MM:00"

  // Transazione: evita la doppia prenotazione dello stesso slot.
  db.exec('BEGIN IMMEDIATE');
  try {
    const occupato = db
      .prepare(
        `SELECT 1 FROM appuntamenti
         WHERE sede_id = ? AND substr(data_ora, 1, 16) = ? AND stato != 'annullato'`
      )
      .get(sedeId, chiave);
    if (occupato) {
      db.exec('ROLLBACK');
      return res.status(409).json({ errors: ['Questo orario è appena stato prenotato. Scegli un altro slot.'] });
    }

    const infoR = db
      .prepare(
        `INSERT INTO richieste (nome, telefono, email, sede_id, canale, trattamento, stato, note)
         VALUES (?, ?, ?, ?, 'diretto', ?, 'convertita', 'Prenotazione online')`
      )
      .run(
        b.nome.trim(),
        b.telefono.trim(),
        b.email ? String(b.email).trim() : null,
        sedeId,
        trattamento
      );

    const infoA = db
      .prepare(
        `INSERT INTO appuntamenti (richiesta_id, sede_id, data_ora, stato)
         VALUES (?, ?, ?, 'programmato')`
      )
      .run(infoR.lastInsertRowid, sedeId, dataOraFull);

    db.exec('COMMIT');
    res.status(201).json({
      appuntamento_id: infoA.lastInsertRowid,
      data_ora: dataOraFull,
      sede: sede.nome,
      nome: b.nome.trim(),
    });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ errors: ['Errore durante la prenotazione: ' + e.message] });
  }
});

// --- Avvio del server ------------------------------------------------------
const PORT = process.env.PORT || 3000;

// Avviamo il server solo se il file è eseguito direttamente (non durante i test).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`SmileFlow in ascolto su http://localhost:${PORT}`);
  });

  // Scheduler: ogni minuto invia i promemoria programmati la cui ora è arrivata.
  setInterval(() => {
    processaProgrammati(db)
      .then((r) => { if (r.inviati || r.errori) console.log(`Scheduler: ${r.inviati} inviati, ${r.errori} errori.`); })
      .catch((e) => console.error('Scheduler errore:', e));
  }, 60 * 1000);
}

export { app, db };
