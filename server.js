// SmileFlow - server Express + API REST.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './db.js';
import { validaRichiesta, validaStatoRichiesta } from './validation.js';
import { tuttiGliStats } from './stats.js';
import { eseguiPromemoria } from './reminders.js';
import {
  passwordCorretta, creaSessione, distruggiSessione,
  tokenDellaRichiesta, tokenValido, richiediAuth, COOKIE_NAME,
} from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = openDb();

const app = express();
app.use(express.json());                                   // legge i corpi JSON
app.use(express.static(join(__dirname, 'public')));        // serve il front-end

// --- AUTENTICAZIONE --------------------------------------------------------
// Rotte pubbliche: login, logout e stato della sessione.

// POST /api/login : verifica la password e crea una sessione (cookie).
app.post('/api/login', (req, res) => {
  if (!passwordCorretta(req.body?.password)) {
    return res.status(401).json({ errors: ['password errata'] });
  }
  const token = creaSessione();
  // httpOnly: il cookie non è leggibile dal JavaScript del browser (anti-XSS).
  res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'strict', path: '/' });
  res.json({ ok: true });
});

// POST /api/logout : chiude la sessione.
app.post('/api/logout', (req, res) => {
  distruggiSessione(tokenDellaRichiesta(req));
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// GET /api/session : indica se la richiesta è autenticata (per il front-end).
app.get('/api/session', (req, res) => {
  res.json({ authenticated: tokenValido(req) });
});

// Barriera: tutte le altre rotte /api richiedono l'autenticazione.
app.use('/api', richiediAuth);

// Converte il filtro "periodo" (giorni) in una clausola SQL sicura.
// Restituisce null se il periodo non è valido/assente (nessun filtro temporale).
function periodoToDate(periodo) {
  const giorni = Number(periodo);
  if (!Number.isInteger(giorni) || giorni <= 0) return null;
  return `-${giorni} days`;
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

// POST /api/promemoria/esegui : lancia l'automazione dei promemoria.
// Corpo: { ore_prima?: number, canale?: 'whatsapp'|'sms'|'email' }
app.post('/api/promemoria/esegui', (req, res) => {
  try {
    const risultato = eseguiPromemoria(db, {
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
