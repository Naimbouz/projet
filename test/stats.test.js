import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import { conversionePerCanale, costoPerAppuntamento, richiesteInAttesa, andamentoRichieste, riepilogoOggi } from '../stats.js';

// Database in memoria con dati controllati (non casuali) per asserzioni precise.
let db;

beforeEach(() => {
  db = openDb(':memory:');
  db.exec("INSERT INTO sedi (id, nome, citta) VALUES (1, 'Sede Test', 'Città')");

  const ins = db.prepare(
    `INSERT INTO richieste (id, nome, telefono, sede_id, canale, trattamento, stato, costo_acquisizione)
     VALUES (?, ?, ?, 1, ?, 'igiene', ?, ?)`
  );
  // creata_il usa il valore di default (datetime('now')), cioè "oggi".
  // google: 2 richieste (A con appuntamento, B senza), costo 30 ciascuna.
  ins.run(1, 'A', '000', 'google', 'nuova', 30);
  ins.run(2, 'B', '000', 'google', 'nuova', 30);
  // meta: 1 richiesta (C con appuntamento), costo 20.
  ins.run(3, 'C', '000', 'meta', 'nuova', 20);

  // Appuntamenti per A e C.
  const insApp = db.prepare(
    "INSERT INTO appuntamenti (richiesta_id, sede_id, data_ora) VALUES (?, 1, datetime('now','+1 day'))"
  );
  insApp.run(1);
  insApp.run(3);
});

test('conversione per canale: tassi corretti', () => {
  const righe = conversionePerCanale(db);
  const google = righe.find((r) => r.canale === 'google');
  const meta = righe.find((r) => r.canale === 'meta');

  assert.equal(google.richieste, 2);
  assert.equal(google.con_appuntamento, 1);
  assert.equal(google.tasso_conversione, 50);

  assert.equal(meta.richieste, 1);
  assert.equal(meta.con_appuntamento, 1);
  assert.equal(meta.tasso_conversione, 100);
});

test('costo per appuntamento: spesa e costo corretti', () => {
  const righe = costoPerAppuntamento(db);
  const google = righe.find((r) => r.canale === 'google');
  const meta = righe.find((r) => r.canale === 'meta');

  assert.equal(google.spesa_totale, 60);          // 30 + 30
  assert.equal(google.appuntamenti, 1);
  assert.equal(google.costo_per_appuntamento, 60); // 60 / 1

  assert.equal(meta.spesa_totale, 20);
  assert.equal(meta.costo_per_appuntamento, 20);
});

test('richieste in attesa oltre 2 giorni: filtra per stato e data', () => {
  // Inseriamo casi mirati con date esplicite.
  const ins = db.prepare(
    `INSERT INTO richieste (nome, telefono, sede_id, canale, trattamento, stato, creata_il)
     VALUES (?, '000', 1, 'diretto', 'igiene', ?, ?)`
  );
  ins.run('Vecchia nuova', 'nuova', "2000-01-01 10:00:00");          // deve comparire
  ins.run('Vecchia convertita', 'convertita', "2000-01-01 10:00:00"); // esclusa (stato finale)

  const righe = richiesteInAttesa(db);
  const nomi = righe.map((r) => r.nome);
  assert.ok(nomi.includes('Vecchia nuova'));
  assert.ok(!nomi.includes('Vecchia convertita'));
  // Le richieste A/B/C sono di oggi -> non devono comparire.
  assert.ok(!nomi.includes('A'));
});

test('andamento richieste: serie continua di N giorni, oggi incluso', () => {
  const serie = andamentoRichieste(db, 14);
  assert.equal(serie.length, 14);
  // A, B, C sono state create oggi -> l'ultimo giorno deve valere almeno 3.
  const oggi = new Date().toISOString().slice(0, 10);
  const ultimo = serie[serie.length - 1];
  assert.equal(ultimo.giorno, oggi);
  assert.ok(ultimo.totale >= 3);
});

test('riepilogo oggi: conta richieste e appuntamenti del giorno', () => {
  const r = riepilogoOggi(db);
  assert.equal(r.richieste_oggi, 3);            // A, B, C
  // Gli appuntamenti del seed di test sono tra +1 giorno -> 0 "oggi", ma 2 nelle prossime 24h.
  assert.equal(r.appuntamenti_prossimi_24h, 2);
});
