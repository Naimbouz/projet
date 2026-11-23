// Connessione al database SQLite tramite il modulo nativo di Node (node:sqlite).
// Esposto come funzione per poter usare un file su disco (app) o la memoria (test).

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Percorso dello schema SQL, risolto rispetto a questo file.
const SCHEMA_PATH = join(__dirname, 'schema.sql');

/**
 * Apre una connessione al database e applica lo schema.
 * @param {string} path - percorso del file .db oppure ':memory:' per i test.
 * @returns {DatabaseSync}
 */
export function openDb(path = join(__dirname, 'smileflow.db')) {
  const db = new DatabaseSync(path);
  // Le chiavi esterne in SQLite non sono attive per default: le abilitiamo.
  db.exec('PRAGMA foreign_keys = ON;');
  // Applichiamo lo schema (CREATE TABLE IF NOT EXISTS: è idempotente).
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}
