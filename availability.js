// Generazione dei "slot" prenotabili a partire da orari di apertura fissi.
// Nessun dato nel database per la disponibilità: gli slot liberi sono calcolati
// dagli orari qui sotto, meno gli appuntamenti già presenti (occupati).

export const ORARI = {
  // Giorni di apertura (JS: domenica=0 ... sabato=6). Lun–Sab.
  giorni: [1, 2, 3, 4, 5, 6],
  // Fasce orarie di apertura (con pausa pranzo).
  fasce: [
    ['09:00', '13:00'],
    ['14:00', '18:00'],
  ],
  slotMin: 30, // durata di uno slot in minuti
  giorniAvanti: 14, // orizzonte di prenotazione (giorni da oggi)
};

const pad = (n) => String(n).padStart(2, '0');
const fmtData = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Genera tutti gli slot FUTURI dei prossimi N giorni, secondo gli orari.
 * @returns {{ data: string, ora: string, data_ora: string }[]}
 *          data_ora nel formato "YYYY-MM-DD HH:MM".
 */
export function generaSlot(now = new Date(), cfg = ORARI) {
  const slots = [];
  for (let g = 0; g < cfg.giorniAvanti; g++) {
    const giorno = new Date(now.getFullYear(), now.getMonth(), now.getDate() + g);
    if (!cfg.giorni.includes(giorno.getDay())) continue;
    const dataStr = fmtData(giorno);

    for (const [inizio, fine] of cfg.fasce) {
      let [h, m] = inizio.split(':').map(Number);
      const [hf, mf] = fine.split(':').map(Number);
      while (h < hf || (h === hf && m < mf)) {
        const hhmm = `${pad(h)}:${pad(m)}`;
        const quando = new Date(`${dataStr}T${hhmm}:00`);
        if (quando > now) {
          slots.push({ data: dataStr, ora: hhmm, data_ora: `${dataStr} ${hhmm}` });
        }
        m += cfg.slotMin;
        if (m >= 60) {
          h += Math.floor(m / 60);
          m %= 60;
        }
      }
    }
  }
  return slots;
}

/**
 * Verifica che una data/ora ("YYYY-MM-DD HH:MM", eventuali secondi ignorati)
 * corrisponda a uno slot valido e futuro secondo gli orari di apertura.
 */
export function slotValido(dataOra, now = new Date(), cfg = ORARI) {
  if (typeof dataOra !== 'string') return false;
  const chiave = dataOra.slice(0, 16); // "YYYY-MM-DD HH:MM"
  return generaSlot(now, cfg).some((s) => s.data_ora === chiave);
}

/**
 * Raggruppa gli slot per giorno, marcando ognuno come 'libero' o 'occupato'.
 * @param {Set<string>} occupati  insieme di chiavi "YYYY-MM-DD HH:MM" occupate.
 */
export function disponibilitaPerGiorno(occupati = new Set(), now = new Date(), cfg = ORARI) {
  const perGiorno = new Map();
  for (const s of generaSlot(now, cfg)) {
    if (!perGiorno.has(s.data)) perGiorno.set(s.data, []);
    perGiorno.get(s.data).push({
      ora: s.ora,
      data_ora: s.data_ora,
      stato: occupati.has(s.data_ora) ? 'occupato' : 'libero',
    });
  }
  return [...perGiorno.entries()].map(([data, slots]) => ({ data, slots }));
}
