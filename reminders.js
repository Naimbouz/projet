// Automazione dei promemoria appuntamenti.
// Email: invio REALE via Brevo (gratuito) se BREVO_API_KEY è configurata,
// altrimenti (e per gli altri canali) l'invio è SIMULATO (scrive nel log).

import { CANALI_PROMEMORIA } from './validation.js';

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

/**
 * Esegue l'automazione: trova gli appuntamenti, invia i promemoria,
 * scrive nel log e aggiorna lo stato. Se l'invio reale fallisce,
 * l'appuntamento NON viene marcato (così può essere ritentato).
 * @returns {Promise<{ inviati: number, saltati: object[], dettagli: object[] }>}
 */
export async function eseguiPromemoria(db, { orePrima = 24, canale = 'whatsapp' } = {}) {
  if (!CANALI_PROMEMORIA.includes(canale)) {
    throw new Error(`canale non valido: ${canale}`);
  }
  const ore = Number(orePrima);
  if (!Number.isInteger(ore) || ore <= 0) {
    throw new Error('ore_prima deve essere un intero positivo');
  }

  const candidati = appuntamentiDaRicordare(db, ore);
  const dettagli = [];
  const saltati = [];

  const insLog = db.prepare(
    `INSERT INTO promemoria_log (appuntamento_id, canale, destinatario, messaggio)
     VALUES (?, ?, ?, ?)`
  );
  const segnaInviato = db.prepare('UPDATE appuntamenti SET promemoria_inviato = 1 WHERE id = ?');

  for (const app of candidati) {
    const destinatario = destinatarioPerCanale(app, canale);
    if (!destinatario) {
      // Es. canale email ma il paziente non ha fornito un indirizzo.
      saltati.push({ appuntamento_id: app.id, motivo: `nessun recapito per il canale ${canale}` });
      continue;
    }
    const oggetto = `Promemoria appuntamento - ${app.sede_nome}`;
    const messaggio =
      `Gentile ${app.nome}, le ricordiamo il suo appuntamento presso ` +
      `${app.sede_nome} il ${app.data_ora}. Risponda per confermare.`;

    try {
      const esito = await inviaMessaggio(canale, destinatario, app.nome, oggetto, messaggio);
      insLog.run(app.id, canale, destinatario, messaggio);
      segnaInviato.run(app.id);
      dettagli.push({ appuntamento_id: app.id, canale, destinatario, messaggio, esito });
    } catch (e) {
      // Invio fallito (es. email rifiutata): registriamo ma non marchiamo inviato.
      saltati.push({ appuntamento_id: app.id, motivo: e.message });
    }
  }

  return { inviati: dettagli.length, saltati, dettagli };
}
