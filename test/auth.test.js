import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordCorretta, creaSessione, tokenValido, distruggiSessione, COOKIE_NAME } from '../auth.js';

// La password di default della demo è 'smileflow' (o ADMIN_PASSWORD).
const PASSWORD = process.env.ADMIN_PASSWORD || 'smileflow';

// Simula l'oggetto "req" di Express con un cookie.
const reqConCookie = (token) => ({ headers: { cookie: `${COOKIE_NAME}=${token}` } });

test('password corretta accettata, errata rifiutata', () => {
  assert.equal(passwordCorretta(PASSWORD), true);
  assert.equal(passwordCorretta('sbagliata'), false);
});

test('sessione: un token creato è valido, uno inventato no', () => {
  const token = creaSessione();
  assert.equal(tokenValido(reqConCookie(token)), true);
  assert.equal(tokenValido(reqConCookie('token-finto')), false);
  assert.equal(tokenValido({ headers: {} }), false); // nessun cookie
});

test('sessione distrutta non è più valida', () => {
  const token = creaSessione();
  distruggiSessione(token);
  assert.equal(tokenValido(reqConCookie(token)), false);
});
