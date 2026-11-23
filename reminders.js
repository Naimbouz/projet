// Automazione dei promemoria appuntamenti.
// Email: invio REALE via Brevo (gratuito) se BREVO_API_KEY è configurata,
// altrimenti (e per gli altri canali) l'invio è SIMULATO (scrive nel log).

import { CANALI_PROMEMORIA, normalizzaDataOra } from './validation.js';

/**
 * Appuntamenti futuri che necessitano un promemoria, entro X ore dall'adesso.
 * Esclude gli appuntamenti annullati/completati e quelli già avvisati.
 */
export function appuntamentiDaRicordare(db, orePrima) {
  return db
    .prepare(
      `SELECT a.id, a.data_ora, a.sede_id,
              r.nome, r.telefono, r.email,
              s.nome AS sede_nome
       FROM appuntamenti a
       JOIN richieste r ON r.id = a.richiesta_id
       JOIN sedi s      ON s.id = a.sede_id
       WHERE a.stato IN ('programmato', 'confermato')
         AND a.promemoria_inviato = 0
         AND a.data_ora > datetime('now')
         AND a.data_ora <= datetime('now', ?)
       ORDER BY a.data_ora ASC`
    )
    .all(`+${orePrima} hours`);
}

/**
 * Appuntamenti selezionati manualmente (per id), ancora idonei al promemoria.
 * Stesso filtro di idoneità, ma senza finestra temporale (scelta esplicita).
 */
export function appuntamentiPerIds(db, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const puliti = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (puliti.length === 0) return [];
  const segnaposti = puliti.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT a.id, a.data_ora, a.sede_id,
              r.nome, r.telefono, r.email,
              s.nome AS sede_nome
       FROM appuntamenti a
       JOIN richieste r ON r.id = a.richiesta_id
       JOIN sedi s      ON s.id = a.sede_id
       WHERE a.id IN (${segnaposti})
         AND a.stato IN ('programmato', 'confermato')
         AND a.promemoria_inviato = 0
       ORDER BY a.data_ora ASC`
    )
    .all(...puliti);
}

/** Sceglie il destinatario in base al canale. */
function destinatarioPerCanale(app, canale) {
  if (canale === 'email') return app.email;     // può essere null
  return app.telefono;                           // whatsapp / sms
}

// Invio reale di un'email tramite l'API di Brevo (HTTP, nessuna libreria).
// Richiede le variabili d'ambiente BREVO_API_KEY e MITTENTE_EMAIL.
async function inviaEmailBrevo(destinatario, nome, oggetto, messaggio) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: process.env.MITTENTE_NOME || 'SmileFlow', email: process.env.MITTENTE_EMAIL },
      to: [{ email: destinatario, name: nome }],
      subject: oggetto,
      textContent: messaggio,
    }),
  });
  if (!r.ok) {
    const corpo = await r.text().catch(() => '');
    throw new Error(`Brevo ${r.status}: ${corpo.slice(0, 140)}`);
  }
}

/**
 * Invia un messaggio. Email reale via Brevo se configurato; altrimenti simulato.
 * @returns {Promise<'reale'|'simulato'>}
 */
async function inviaMessaggio(canale, destinatario, nome, oggetto, messaggio) {
  if (canale === 'email' && process.env.BREVO_API_KEY && process.env.MITTENTE_EMAIL) {
    await inviaEmailBrevo(destinatario, nome, oggetto, messaggio);
    return 'reale';
  }
  // Nessun provider configurato (o canale non email): simulazione nel log.
  console.log(`[PROMEMORIA ${canale}] -> ${destinatario}: ${messaggio}`);
  return 'simulato';
}

// Invia il promemoria per UN appuntamento: invia, registra nel log e marca inviato.
// Riutilizzato sia dall'invio immediato sia dallo scheduler dei programmati.
// @returns {Promise<{ ok: boolean, motivo?: string, esito?: string }>}
async function inviaAppuntamento(db, app, canale) {
  const destinatario = destinatarioPerCanale(app, canale);
  if (!destinatario) {
    return { ok: false, motivo: `nessun recapito per il canale ${canale}` };
  }
  const oggetto = `Promemoria appuntamento - ${app.sede_nome}`;
  const messaggio =
    `Gentile ${app.nome}, le ricordiamo il suo appuntamento presso ` +
    `${app.sede_nome} il ${app.data_ora}. Risponda per confermare.`;
  try {
    const esito = await inviaMessaggio(canale, destinatario, app.nome, oggetto, messaggio);
    db.prepare(
      `INSERT INTO promemoria_log (appuntamento_id, canale, destinatario, messaggio)
       VALUES (?, ?, ?, ?)`
    ).run(app.id, canale, destinatario, messaggio);
    db.prepare('UPDATE appuntamenti SET promemoria_inviato = 1 WHERE id = ?').run(app.id);
    return { ok: true, esito, destinatario };
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
}

/**
 * Invio IMMEDIATO. Due modalità: id spuntati, oppure finestra "ore prima".
 * @returns {Promise<{ inviati: number, saltati: object[], dettagli: object[] }>}
 */
export async function eseguiPromemoria(db, { orePrima = 24, canale = 'whatsapp', ids = null } = {}) {
  if (!CANALI_PROMEMORIA.includes(canale)) {
    throw new Error(`canale non valido: ${canale}`);
  }
  let candidati;
  if (Array.isArray(ids) && ids.length > 0) {
    candidati = appuntamentiPerIds(db, ids);
  } else {
    const ore = Number(orePrima);
    if (!Number.isInteger(ore) || ore <= 0) {
      throw new Error('ore_prima deve essere un intero positivo');
    }
    candidati = appuntamentiDaRicordare(db, ore);
  }

  const dettagli = [];
  const saltati = [];
  for (const app of candidati) {
    const r = await inviaAppuntamento(db, app, canale);
    if (r.ok) dettagli.push({ appuntamento_id: app.id, canale, destinatario: r.destinatario, esito: r.esito });
    else saltati.push({ appuntamento_id: app.id, motivo: r.motivo });
  }
  return { inviati: dettagli.length, saltati, dettagli };
}

/**
 * PROGRAMMA l'invio dei promemoria a una data/ora futura.
 * @returns {{ programmati: number, saltati: object[] }}
 */
export function programmaPromemoria(db, { ids = [], canale = 'whatsapp', inviaIl } = {}) {
  if (!CANALI_PROMEMORIA.includes(canale)) {
    throw new Error(`canale non valido: ${canale}`);
  }
  const quando = normalizzaDataOra(inviaIl);
  if (!quando) {
    throw new Error('invia_il: data/ora non valida (formato "YYYY-MM-DD HH:MM")');
  }
  const candidati = appuntamentiPerIds(db, ids);
  const ins = db.prepare(
    'INSERT INTO promemoria_programmati (appuntamento_id, canale, invia_il) VALUES (?, ?, ?)'
  );
  let programmati = 0;
  for (const app of candidati) {
    ins.run(app.id, canale, quando);
    programmati++;
  }
  return { programmati, saltati: [] };
}

/**
 * Scheduler: invia i promemoria programmati la cui ora è arrivata.
 * Da richiamare periodicamente (setInterval). Sicuro se non c'è nulla da fare.
 * @returns {Promise<{ inviati: number, errori: number }>}
 */
export async function processaProgrammati(db) {
  const dovuti = db
    .prepare(
      "SELECT * FROM promemoria_programmati WHERE stato = 'in_attesa' AND invia_il <= datetime('now')"
    )
    .all();

  let inviati = 0;
  let errori = 0;
  const getApp = db.prepare(
    `SELECT a.id, a.data_ora, a.sede_id, r.nome, r.telefono, r.email, s.nome AS sede_nome
     FROM appuntamenti a
     JOIN richieste r ON r.id = a.richiesta_id
     JOIN sedi s      ON s.id = a.sede_id
     WHERE a.id = ? AND a.stato IN ('programmato','confermato') AND a.promemoria_inviato = 0`
  );
  const aggiorna = db.prepare('UPDATE promemoria_programmati SET stato = ? WHERE id = ?');

  for (const p of dovuti) {
    const app = getApp.get(p.appuntamento_id);
    if (!app) {
      // Appuntamento non più idoneo (annullato o già avvisato).
      aggiorna.run('errore', p.id);
      errori++;
      continue;
    }
    const r = await inviaAppuntamento(db, app, p.canale);
    aggiorna.run(r.ok ? 'inviato' : 'errore', p.id);
    if (r.ok) inviati++;
    else errori++;
  }
  return { inviati, errori };
}
