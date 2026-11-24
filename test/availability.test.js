import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generaSlot, slotValido, disponibilitaPerGiorno, ORARI } from '../availability.js';

// Un lunedì alle 08:00 come riferimento stabile per i test.
const LUNEDI_8 = new Date('2026-11-23T08:00:00');

test('generaSlot produce solo slot futuri', () => {
  const now = new Date('2026-11-23T10:15:00'); // lunedì mattina
  const slots = generaSlot(now);
  assert.ok(slots.length > 0);
  for (const s of slots) {
    assert.ok(new Date(`${s.data}T${s.ora}:00`) > now, `slot ${s.data_ora} non futuro`);
  }
});

test('generaSlot salta la domenica', () => {
  const slots = generaSlot(LUNEDI_8);
  const domeniche = slots.filter((s) => new Date(`${s.data}T00:00:00`).getDay() === 0);
  assert.equal(domeniche.length, 0);
});

test('generaSlot rispetta le fasce orarie (niente pausa pranzo)', () => {
  const slots = generaSlot(LUNEDI_8).filter((s) => s.data === '2026-11-23');
  const ore = slots.map((s) => s.ora);
  assert.ok(ore.includes('09:00'));
  assert.ok(ore.includes('12:30'));
  assert.ok(!ore.includes('13:00'), 'le 13:00 sono chiuse');
  assert.ok(!ore.includes('13:30'), 'pausa pranzo');
  assert.ok(ore.includes('14:00'));
  assert.ok(ore.includes('17:30'));
  assert.ok(!ore.includes('18:00'), 'le 18:00 sono chiuse (fine)');
});

test('slotValido accetta uno slot generato e rifiuta gli altri', () => {
  const now = LUNEDI_8;
  const uno = generaSlot(now)[0];
  assert.equal(slotValido(uno.data_ora, now), true);
  assert.equal(slotValido('2026-11-23 13:15', now), false); // non su griglia
  assert.equal(slotValido('2020-01-01 09:00', now), false); // passato
  assert.equal(slotValido('spazzatura', now), false);
});

test('disponibilitaPerGiorno marca gli occupati', () => {
  const now = LUNEDI_8;
  const primo = generaSlot(now)[0];
  const giorni = disponibilitaPerGiorno(new Set([primo.data_ora]), now);
  const slot = giorni.flatMap((g) => g.slots).find((s) => s.data_ora === primo.data_ora);
  assert.equal(slot.stato, 'occupato');
});

test('ORARI espone la configurazione attesa', () => {
  assert.equal(ORARI.slotMin, 30);
  assert.deepEqual(ORARI.giorni, [1, 2, 3, 4, 5, 6]);
});
