import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validaRichiesta, validaStatoRichiesta } from '../validation.js';

test('richiesta valida: nessun errore e valori normalizzati', () => {
  const { errors, value } = validaRichiesta({
    nome: '  Mario Rossi ',
    telefono: '+378 333 1234567',
    sede_id: '2',
    canale: 'google',
    trattamento: 'igiene',
  });
  assert.deepEqual(errors, []);
  assert.equal(value.nome, 'Mario Rossi');     // trim applicato
  assert.equal(value.sede_id, 2);              // convertito a numero
  assert.equal(value.email, null);             // opzionale assente
});

test('richiesta: campi obbligatori mancanti', () => {
  const { errors, value } = validaRichiesta({});
  assert.equal(value, null);
  assert.ok(errors.some((e) => e.startsWith('nome')));
  assert.ok(errors.some((e) => e.startsWith('telefono')));
  assert.ok(errors.some((e) => e.startsWith('sede_id')));
  assert.ok(errors.some((e) => e.startsWith('canale')));
  assert.ok(errors.some((e) => e.startsWith('trattamento')));
});

test('richiesta: canale e trattamento fuori dai valori ammessi', () => {
  const { errors } = validaRichiesta({
    nome: 'Test',
    telefono: '0549123456',
    sede_id: 1,
    canale: 'tiktok',
    trattamento: 'magia',
  });
  assert.ok(errors.some((e) => e.startsWith('canale')));
  assert.ok(errors.some((e) => e.startsWith('trattamento')));
});

test('richiesta: email con formato non valido', () => {
  const { errors } = validaRichiesta({
    nome: 'Test',
    telefono: '0549123456',
    sede_id: 1,
    canale: 'meta',
    trattamento: 'igiene',
    email: 'non-una-email',
  });
  assert.ok(errors.some((e) => e.startsWith('email')));
});

test('richiesta: telefono con caratteri non ammessi', () => {
  const { errors } = validaRichiesta({
    nome: 'Test',
    telefono: 'chiamami!',
    sede_id: 1,
    canale: 'meta',
    trattamento: 'igiene',
  });
  assert.ok(errors.some((e) => e.startsWith('telefono')));
});

test('stato richiesta: valido e non valido', () => {
  assert.deepEqual(validaStatoRichiesta('convertita').errors, []);
  assert.equal(validaStatoRichiesta('convertita').value, 'convertita');
  assert.ok(validaStatoRichiesta('inventato').errors.length > 0);
});
