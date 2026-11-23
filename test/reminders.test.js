import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import { eseguiPromemoria } from '../reminders.js';

let db;

beforeEach(() => {
  db = openDb(':memory:');
  db.exec("INSERT INTO sedi (id, nome, citta) VALUES (1, 'Sede Test', 'Città')");
  // Richiesta con telefono ma SENZA email (per testare il canale email).
  db.prepare(
    `INSERT INTO richieste (id, nome, telefono, email, sede_id, canale, trattamento)
     VALUES (1, 'Paziente Uno', '+378 333 0000000', NULL, 1, 'google', 'igiene')`
  ).run();
  // Appuntamento tra 5 ore (dentro la finestra di 24h).
  db.prepare(
    "INSERT INTO appuntamenti (id, richiesta_id, sede_id, data_ora) VALUES (1, 1, 1, datetime('now','+5 hours'))"
  ).run();
});

test('invia un promemoria e aggiorna stato + log', () => {
  const r = eseguiPromemoria(db, { orePrima: 24, canale: 'whatsapp' });
  assert.equal(r.inviati, 1);

  const app = db.prepare('SELECT promemoria_inviato FROM appuntamenti WHERE id = 1').get();
  assert.equal(app.promemoria_inviato, 1);

  const log = db.prepare('SELECT * FROM promemoria_log WHERE appuntamento_id = 1').get();
  assert.equal(log.canale, 'whatsapp');
  assert.ok(log.messaggio.includes('Paziente Uno'));
});

test('idempotenza: il secondo passaggio non reinvia', () => {
  eseguiPromemoria(db, { orePrima: 24, canale: 'whatsapp' });
  const r2 = eseguiPromemoria(db, { orePrima: 24, canale: 'whatsapp' });
  assert.equal(r2.inviati, 0);
});

test('appuntamento fuori finestra non viene avvisato', () => {
  // Spostiamo l'appuntamento a +48h: con finestra 24h non deve rientrare.
  db.prepare("UPDATE appuntamenti SET data_ora = datetime('now','+48 hours') WHERE id = 1").run();
  const r = eseguiPromemoria(db, { orePrima: 24, canale: 'whatsapp' });
  assert.equal(r.inviati, 0);
});

test('canale email senza indirizzo: appuntamento saltato', () => {
  const r = eseguiPromemoria(db, { orePrima: 24, canale: 'email' });
  assert.equal(r.inviati, 0);
  assert.equal(r.saltati.length, 1);
});

test('canale non valido: errore', () => {
  assert.throws(() => eseguiPromemoria(db, { canale: 'piccione' }), /canale non valido/);
});
