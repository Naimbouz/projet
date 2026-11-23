-- SmileFlow - schema del database (SQLite)
-- Dati esclusivamente fittizi: nessun dato reale di pazienti.

PRAGMA foreign_keys = ON;

-- Le sedi (studi dentistici) della catena.
CREATE TABLE IF NOT EXISTS sedi (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT NOT NULL,
  citta     TEXT NOT NULL,
  telefono  TEXT
);

-- Le richieste di contatto generate dai canali di marketing (i "lead").
CREATE TABLE IF NOT EXISTS richieste (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                TEXT NOT NULL,
  telefono            TEXT NOT NULL,
  email               TEXT,
  sede_id             INTEGER NOT NULL,
  -- canale = utm_source della pagina da cui arriva la richiesta.
  canale              TEXT NOT NULL CHECK (canale IN ('google','meta','instagram','referral','diretto')),
  trattamento         TEXT NOT NULL CHECK (trattamento IN ('igiene','ortodonzia','implantologia','sbiancamento','estetica','controllo')),
  stato               TEXT NOT NULL DEFAULT 'nuova' CHECK (stato IN ('nuova','contattata','in_attesa','convertita','persa')),
  -- costo di acquisizione del lead (es. costo per lead della campagna pubblicitaria).
  costo_acquisizione  REAL NOT NULL DEFAULT 0 CHECK (costo_acquisizione >= 0),
  note                TEXT,
  creata_il           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sede_id) REFERENCES sedi(id) ON DELETE RESTRICT
);

-- Gli appuntamenti fissati a partire da una richiesta.
CREATE TABLE IF NOT EXISTS appuntamenti (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  richiesta_id        INTEGER NOT NULL,
  sede_id             INTEGER NOT NULL,
  data_ora            TEXT NOT NULL,                 -- data/ora dell'appuntamento (ISO 8601)
  stato               TEXT NOT NULL DEFAULT 'programmato' CHECK (stato IN ('programmato','confermato','completato','annullato')),
  promemoria_inviato  INTEGER NOT NULL DEFAULT 0 CHECK (promemoria_inviato IN (0,1)),
  creato_il           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (richiesta_id) REFERENCES richieste(id) ON DELETE CASCADE,
  FOREIGN KEY (sede_id)      REFERENCES sedi(id)      ON DELETE RESTRICT
);

-- Registro (log) dei promemoria inviati dall'automazione.
CREATE TABLE IF NOT EXISTS promemoria_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  appuntamento_id INTEGER NOT NULL,
  canale          TEXT NOT NULL CHECK (canale IN ('whatsapp','sms','email')),
  destinatario    TEXT NOT NULL,
  messaggio       TEXT NOT NULL,
  inviato_il      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (appuntamento_id) REFERENCES appuntamenti(id) ON DELETE CASCADE
);

-- Promemoria programmati (invio differito a una data/ora scelta).
CREATE TABLE IF NOT EXISTS promemoria_programmati (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  appuntamento_id INTEGER NOT NULL,
  canale          TEXT NOT NULL CHECK (canale IN ('whatsapp','sms','email')),
  invia_il        TEXT NOT NULL,                 -- quando inviare (ISO 8601)
  stato           TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa','inviato','errore')),
  creato_il       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (appuntamento_id) REFERENCES appuntamenti(id) ON DELETE CASCADE
);

-- Indici utili per i filtri e le statistiche.
CREATE INDEX IF NOT EXISTS idx_richieste_canale   ON richieste(canale);
CREATE INDEX IF NOT EXISTS idx_richieste_sede      ON richieste(sede_id);
CREATE INDEX IF NOT EXISTS idx_richieste_creata    ON richieste(creata_il);
CREATE INDEX IF NOT EXISTS idx_appuntamenti_data   ON appuntamenti(data_ora);
