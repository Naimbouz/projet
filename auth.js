// Autenticazione admin minima, senza dipendenze esterne (modulo crypto nativo).
// La password si imposta con la variabile d'ambiente ADMIN_PASSWORD
// (valore di default solo per la demo).

import crypto from 'node:crypto';

const PASSWORD = process.env.ADMIN_PASSWORD || 'smileflow';
export const COOKIE_NAME = 'sf_session';

// Store delle sessioni valide in memoria (si svuota al riavvio del server).
const sessioni = new Set();

// Confronto a tempo costante per evitare timing attack.
// Usiamo l'hash SHA-256 così i due buffer hanno sempre la stessa lunghezza
// (e non si rivela la lunghezza della password).
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
export function passwordCorretta(tentativo) {
  return crypto.timingSafeEqual(hash(tentativo), hash(PASSWORD));
}

export function creaSessione() {
  const token = crypto.randomBytes(24).toString('hex');
  sessioni.add(token);
  return token;
}

export function distruggiSessione(token) {
  sessioni.delete(token);
}

// Legge un cookie dall'header della richiesta (senza libreria esterna).
function leggiCookie(req, nome) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const parte of raw.split(';')) {
    const [chiave, ...valore] = parte.trim().split('=');
    if (chiave === nome) return decodeURIComponent(valore.join('='));
  }
  return null;
}

export function tokenValido(req) {
  const token = leggiCookie(req, COOKIE_NAME);
  return Boolean(token) && sessioni.has(token);
}

export function tokenDellaRichiesta(req) {
  return leggiCookie(req, COOKIE_NAME);
}

// Middleware Express: blocca le richieste non autenticate.
export function richiediAuth(req, res, next) {
  if (tokenValido(req)) return next();
  res.status(401).json({ errors: ['non autenticato'] });
}
