// SmileFlow - server Express + API REST.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './db.js';
import { validaRichiesta, validaStatoRichiesta } from './validation.js';
import { tuttiGliStats } from './stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = openDb();

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

// GET /api/richieste : elenco con filtri opzionali (sede, periodo in giorni).
app.get('/api/richieste', (req, res) => {
  const condizioni = [];
  const parametri = [];

  if (req.query.sede) {
    condizioni.push('r.sede_id = ?');
    parametri.push(Number(req.query.sede));
  }
  const periodo = periodoToDate(req.query.periodo);
  if (periodo) {
    condizioni.push("r.creata_il >= datetime('now', ?)");
    parametri.push(periodo);
  }

  const where = condizioni.length ? `WHERE ${condizioni.join(' AND ')}` : '';
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

// --- Avvio del server ------------------------------------------------------
const PORT = process.env.PORT || 3000;

// Avviamo il server solo se il file è eseguito direttamente (non durante i test).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`SmileFlow in ascolto su http://localhost:${PORT}`);
  });
}

export { app, db };
