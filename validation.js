// Validazione lato server degli input dell'API.
// Funzioni pure (senza database) per poterle testare facilmente.

export const CANALI = ['google', 'meta', 'instagram', 'referral', 'diretto'];
export const TRATTAMENTI = ['igiene', 'ortodonzia', 'implantologia', 'sbiancamento', 'estetica', 'controllo'];
export const STATI_RICHIESTA = ['nuova', 'contattata', 'in_attesa', 'convertita', 'persa'];
export const STATI_APPUNTAMENTO = ['programmato', 'confermato', 'completato', 'annullato'];
export const CANALI_PROMEMORIA = ['whatsapp', 'sms', 'email'];

const isStringaPiena = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Valida il corpo di una nuova richiesta di contatto.
 * @returns {{ errors: string[], value: object|null }}
 */
export function validaRichiesta(body = {}) {
  const errors = [];

  if (!isStringaPiena(body.nome)) {
    errors.push('nome: obbligatorio');
  } else if (body.nome.trim().length > 100) {
    errors.push('nome: massimo 100 caratteri');
  }

  if (!isStringaPiena(body.telefono)) {
    errors.push('telefono: obbligatorio');
  } else if (!/^[0-9+().\s-]{6,25}$/.test(body.telefono.trim())) {
    errors.push('telefono: formato non valido');
  }

  const sedeId = Number(body.sede_id);
  if (!Number.isInteger(sedeId) || sedeId <= 0) {
    errors.push('sede_id: intero positivo obbligatorio');
  }

  if (!CANALI.includes(body.canale)) {
    errors.push(`canale: valore ammesso ${CANALI.join(', ')}`);
  }

  if (!TRATTAMENTI.includes(body.trattamento)) {
    errors.push(`trattamento: valore ammesso ${TRATTAMENTI.join(', ')}`);
  }

  // email opzionale, ma se presente deve avere un formato plausibile.
  if (body.email != null && body.email !== '') {
    if (typeof body.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
      errors.push('email: formato non valido');
    }
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors: [],
    value: {
      nome: body.nome.trim(),
      telefono: body.telefono.trim(),
      email: body.email ? String(body.email).trim() : null,
      sede_id: sedeId,
      canale: body.canale,
      trattamento: body.trattamento,
      note: isStringaPiena(body.note) ? body.note.trim() : null,
    },
  };
}

/**
 * Valida il nuovo stato per una richiesta (PATCH).
 * @returns {{ errors: string[], value: string|null }}
 */
export function validaStatoRichiesta(stato) {
  if (!STATI_RICHIESTA.includes(stato)) {
    return { errors: [`stato: valore ammesso ${STATI_RICHIESTA.join(', ')}`], value: null };
  }
  return { errors: [], value: stato };
}

// Normalizza una data/ora in formato "YYYY-MM-DD HH:MM:SS" (accetta anche "T").
// Restituisce null se la stringa non è una data valida.
export function normalizzaDataOra(input) {
  if (typeof input !== 'string' || input.trim() === '') return null;
  const s = input.trim().replace('T', ' ');
  // Accetta "YYYY-MM-DD HH:MM" o con i secondi.
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4] || '00'}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${m[1]} ${m[2]}:${m[3]}:${m[4] || '00'}`;
}

/**
 * Valida la creazione di un appuntamento a partire da una richiesta.
 * @returns {{ errors: string[], value: object|null }}
 */
export function validaAppuntamento(body = {}) {
  const errors = [];

  const richiestaId = Number(body.richiesta_id);
  if (!Number.isInteger(richiestaId) || richiestaId <= 0) {
    errors.push('richiesta_id: intero positivo obbligatorio');
  }

  const dataOra = normalizzaDataOra(body.data_ora);
  if (!dataOra) {
    errors.push('data_ora: formato richiesto "YYYY-MM-DD HH:MM"');
  }

  if (errors.length > 0) return { errors, value: null };
  return { errors: [], value: { richiesta_id: richiestaId, data_ora: dataOra } };
}

/**
 * Valida il nuovo stato per un appuntamento (PATCH).
 * @returns {{ errors: string[], value: string|null }}
 */
export function validaStatoAppuntamento(stato) {
  if (!STATI_APPUNTAMENTO.includes(stato)) {
    return { errors: [`stato: valore ammesso ${STATI_APPUNTAMENTO.join(', ')}`], value: null };
  }
  return { errors: [], value: stato };
}
