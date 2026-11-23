// Query SQL per i KPI (indicatori di performance).
// Ogni funzione riceve il database e restituisce dati pronti per il front-end.

/**
 * Tasso di conversione per canale (utm_source).
 * Una richiesta è "convertita" se ha almeno un appuntamento associato.
 */
export function conversionePerCanale(db) {
  return db
    .prepare(
      `SELECT r.canale,
              COUNT(DISTINCT r.id)              AS richieste,
              COUNT(DISTINCT a.richiesta_id)    AS con_appuntamento,
              ROUND(100.0 * COUNT(DISTINCT a.richiesta_id) / COUNT(DISTINCT r.id), 1)
                                                AS tasso_conversione
       FROM richieste r
       LEFT JOIN appuntamenti a ON a.richiesta_id = r.id
       GROUP BY r.canale
       ORDER BY tasso_conversione DESC`
    )
    .all();
}

/**
 * Costo per appuntamento per canale.
 * Spesa e appuntamenti sono calcolati separatamente per evitare di contare
 * due volte il costo quando una richiesta ha più appuntamenti.
 */
export function costoPerAppuntamento(db) {
  return db
    .prepare(
      `SELECT c.canale,
              c.spesa_totale,
              COALESCE(a.appuntamenti, 0) AS appuntamenti,
              CASE WHEN COALESCE(a.appuntamenti, 0) = 0 THEN NULL
                   ELSE ROUND(c.spesa_totale / a.appuntamenti, 2)
              END AS costo_per_appuntamento
       FROM (
         SELECT canale, ROUND(SUM(costo_acquisizione), 2) AS spesa_totale
         FROM richieste GROUP BY canale
       ) c
       LEFT JOIN (
         SELECT r.canale, COUNT(ap.id) AS appuntamenti
         FROM richieste r
         JOIN appuntamenti ap ON ap.richiesta_id = r.id
         GROUP BY r.canale
       ) a ON a.canale = c.canale
       ORDER BY costo_per_appuntamento`
    )
    .all();
}

/**
 * Richieste ancora in attesa da più di 2 giorni (da ricontattare con priorità).
 */
export function richiesteInAttesa(db) {
  return db
    .prepare(
      `SELECT r.id, r.nome, r.canale, r.stato, r.creata_il,
              s.nome AS sede_nome,
              CAST(julianday('now') - julianday(r.creata_il) AS INTEGER) AS giorni_attesa
       FROM richieste r
       JOIN sedi s ON s.id = r.sede_id
       WHERE r.stato IN ('nuova', 'contattata', 'in_attesa')
         AND r.creata_il < datetime('now', '-2 days')
       ORDER BY r.creata_il ASC`
    )
    .all();
}

/**
 * Andamento delle richieste negli ultimi N giorni (per il grafico).
 * I giorni senza richieste vengono riempiti con 0 in JavaScript.
 */
export function andamentoRichieste(db, giorni = 14) {
  const righe = db
    .prepare(
      `SELECT date(creata_il) AS giorno, COUNT(*) AS totale
       FROM richieste
       WHERE creata_il >= date('now', ?)
       GROUP BY giorno`
    )
    .all(`-${giorni - 1} days`);

  const conteggi = new Map(righe.map((r) => [r.giorno, r.totale]));
  const serie = [];
  for (let i = giorni - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const giorno = d.toISOString().slice(0, 10);
    serie.push({ giorno, totale: conteggi.get(giorno) || 0 });
  }
  return serie;
}

/** Riepilogo operativo "di oggi" per le card in alto. */
export function riepilogoOggi(db) {
  const richiesteOggi = db
    .prepare("SELECT COUNT(*) c FROM richieste WHERE date(creata_il) = date('now')")
    .get().c;
  const appuntamentiOggi = db
    .prepare("SELECT COUNT(*) c FROM appuntamenti WHERE date(data_ora) = date('now') AND stato != 'annullato'")
    .get().c;
  const prossimi24h = db
    .prepare(
      `SELECT COUNT(*) c FROM appuntamenti
       WHERE stato IN ('programmato','confermato')
         AND data_ora > datetime('now') AND data_ora <= datetime('now','+24 hours')`
    )
    .get().c;
  return { richieste_oggi: richiesteOggi, appuntamenti_oggi: appuntamentiOggi, appuntamenti_prossimi_24h: prossimi24h };
}

/** Raggruppa tutti i KPI in un unico oggetto. */
export function tuttiGliStats(db) {
  return {
    riepilogo_oggi: riepilogoOggi(db),
    andamento_richieste: andamentoRichieste(db),
    conversione_per_canale: conversionePerCanale(db),
    costo_per_appuntamento: costoPerAppuntamento(db),
    richieste_in_attesa_oltre_2_giorni: richiesteInAttesa(db),
  };
}
