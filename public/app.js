// SmileFlow - logica front-end. Chiama l'API con fetch e popola gli schermi.

// --- Utility ---------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const api = async (url, options) => {
  const res = await fetch(url, options);
  const dati = await res.json().catch(() => ({}));
  if (!res.ok) throw dati;
  return dati;
};
const fmtData = (iso) => (iso ? iso.replace('T', ' ').slice(0, 16) : '');
// Protezione minima contro l'HTML nei dati inseriti dagli utenti.
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Notifica temporanea (toast) in basso a destra.
function toast(messaggio, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = messaggio;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Disegna un istogramma SVG (una sola serie: richieste per giorno).
function renderGrafico(serie) {
  const W = 560, H = 180, padL = 28, padR = 10, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const base = padT + plotH;
  const max = Math.max(1, ...serie.map((d) => d.totale));
  const slot = plotW / serie.length;
  const bw = Math.max(4, slot - 8);

  const barre = serie
    .map((d, i) => {
      const h = (d.totale / max) * plotH;
      const x = padL + i * slot + (slot - bw) / 2;
      const y = base - h;
      const gg = d.giorno.slice(8, 10); // giorno del mese
      const etichetta = i % 2 === 0
        ? `<text class="chart-label" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${gg}</text>`
        : '';
      return `<rect class="chart-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3">
                <title>${d.giorno}: ${d.totale}</title></rect>${etichetta}`;
    })
    .join('');

  $('#grafico').innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Richieste per giorno">
      <line class="chart-axis" x1="${padL}" y1="${base}" x2="${W - padR}" y2="${base}" />
      <text class="chart-label" x="${padL - 6}" y="${padT + 6}" text-anchor="end">${max}</text>
      <text class="chart-label" x="${padL - 6}" y="${base}" text-anchor="end">0</text>
      ${barre}
    </svg>`;
}

// --- Traduzione "a caldo" (IT di default, FR su richiesta) -----------------
// Nota: si traducono solo le etichette dell'interfaccia. I valori nei dati
// (es. "nuova", "google") restano invariati perché sono dati, non testo UI.
const I18N = {
  it: {
    tagline: 'Richieste, appuntamenti e promemoria — demo', badge_demo: 'dati fittizi',
    utm_pre: 'Arrivi dal canale', utm_post: '— lo registriamo con la tua richiesta.',
    tab_dashboard: 'Dashboard', tab_richieste: 'Richieste', tab_appuntamenti: 'Appuntamenti', tab_dati: 'Dati e SQL',
    kpi_title: 'Indicatori (KPI)',
    h_conversione: 'Conversione per canale', h_costo: 'Costo per appuntamento',
    h_attesa: 'Richieste in attesa da oltre 2 giorni',
    h_nuova_richiesta: 'Nuova richiesta di contatto', h_elenco_richieste: 'Elenco richieste',
    h_automazione: 'Automazione promemoria', h_appuntamenti_prog: 'Appuntamenti in programma',
    h_modello_dati: 'Modello dati e query', h_esempio_query: 'Esempio di query dei KPI',
    p_modello: 'Il database SQLite ha quattro tabelle con chiavi esterne e vincoli CHECK.',
    th_canale: 'Canale', th_richieste: 'Richieste', th_con_app: 'Con appuntamento', th_tasso: 'Tasso',
    th_spesa: 'Spesa totale', th_appuntamenti: 'Appuntamenti', th_costo_app: 'Costo / appuntamento',
    th_nome: 'Nome', th_sede: 'Sede', th_stato: 'Stato', th_giorni: 'Giorni',
    th_telefono: 'Telefono', th_trattamento: 'Trattamento', th_data: 'Data',
    th_dataora: 'Data/ora', th_paziente: 'Paziente', th_promemoria: 'Promemoria',
    lbl_nome: 'Nome e cognome', lbl_telefono: 'Telefono', lbl_email: 'Email (opzionale)',
    lbl_sede: 'Sede', lbl_canale: 'Canale (utm_source)', lbl_trattamento: 'Trattamento',
    lbl_note: 'Note (opzionale)', lbl_periodo: 'Periodo', lbl_ore_prima: "Ore prima dell'appuntamento",
    btn_invia: 'Invia richiesta', btn_promemoria: 'Esegui promemoria',
    opt_tutte: 'Tutte', opt_tutto: 'Tutto', opt_7: 'Ultimi 7 giorni', opt_30: 'Ultimi 30 giorni', opt_90: 'Ultimi 90 giorni',
    kpi_tot_richieste: 'Richieste totali', kpi_convertite: 'Convertite in appuntamento',
    kpi_tasso_medio: 'Tasso di conversione medio', kpi_in_attesa: 'In attesa da oltre 2 giorni',
    esito_registrata: 'Richiesta registrata ✔', esito_errore: 'Errore imprevisto',
    prom_result: 'Promemoria inviati: {0} (saltati: {1})', inviato: 'inviato',
    h_andamento: 'Andamento richieste (14 giorni)',
    kpi_oggi_richieste: 'Richieste oggi', kpi_oggi_appuntamenti: 'Appuntamenti oggi', kpi_prossimi24h: 'Appuntamenti prossime 24h',
    lbl_cerca: 'Cerca (nome o telefono)', opt_tutti: 'Tutti',
    btn_export: 'Esporta CSV', th_azioni: 'Azioni',
    btn_fissa: 'Fissa appuntamento', btn_conferma: 'Conferma', btn_annulla: 'Annulla',
    toast_appuntamento_ok: 'Appuntamento fissato', toast_stato_ok: 'Stato aggiornato', toast_errore: 'Operazione non riuscita',
    tab_promemoria: 'Promemoria', lbl_finestra: 'Finestra temporale', h_da_avvisare: 'Appuntamenti da avvisare',
    th_contatto: 'Contatto',
    opt_f24: 'Entro 24 ore', opt_f48: 'Entro 48 ore', opt_f72: 'Entro 72 ore', opt_f168: 'Entro 7 giorni',
    prom_hint: 'Spunta gli appuntamenti da avvisare; se non spunti nulla, verranno avvisati tutti quelli elencati.',
  },
  fr: {
    tagline: 'Demandes, rendez-vous et rappels — démo', badge_demo: 'données fictives',
    utm_pre: 'Tu arrives du canal', utm_post: '— nous l\'enregistrons avec ta demande.',
    tab_dashboard: 'Tableau de bord', tab_richieste: 'Demandes', tab_appuntamenti: 'Rendez-vous', tab_dati: 'Données et SQL',
    kpi_title: 'Indicateurs (KPI)',
    h_conversione: 'Conversion par canal', h_costo: 'Coût par rendez-vous',
    h_attesa: 'Demandes en attente depuis plus de 2 jours',
    h_nuova_richiesta: 'Nouvelle demande de contact', h_elenco_richieste: 'Liste des demandes',
    h_automazione: 'Automatisation des rappels', h_appuntamenti_prog: 'Rendez-vous programmés',
    h_modello_dati: 'Modèle de données et requêtes', h_esempio_query: 'Exemple de requête des KPI',
    p_modello: 'La base SQLite a quatre tables avec clés étrangères et contraintes CHECK.',
    th_canale: 'Canal', th_richieste: 'Demandes', th_con_app: 'Avec rendez-vous', th_tasso: 'Taux',
    th_spesa: 'Dépense totale', th_appuntamenti: 'Rendez-vous', th_costo_app: 'Coût / rendez-vous',
    th_nome: 'Nom', th_sede: 'Cabinet', th_stato: 'Statut', th_giorni: 'Jours',
    th_telefono: 'Téléphone', th_trattamento: 'Soin', th_data: 'Date',
    th_dataora: 'Date/heure', th_paziente: 'Patient', th_promemoria: 'Rappel',
    lbl_nome: 'Nom et prénom', lbl_telefono: 'Téléphone', lbl_email: 'Email (optionnel)',
    lbl_sede: 'Cabinet', lbl_canale: 'Canal (utm_source)', lbl_trattamento: 'Soin',
    lbl_note: 'Notes (optionnel)', lbl_periodo: 'Période', lbl_ore_prima: 'Heures avant le rendez-vous',
    btn_invia: 'Envoyer la demande', btn_promemoria: 'Lancer les rappels',
    opt_tutte: 'Tous', opt_tutto: 'Tout', opt_7: '7 derniers jours', opt_30: '30 derniers jours', opt_90: '90 derniers jours',
    kpi_tot_richieste: 'Demandes totales', kpi_convertite: 'Converties en rendez-vous',
    kpi_tasso_medio: 'Taux de conversion moyen', kpi_in_attesa: 'En attente depuis plus de 2 jours',
    esito_registrata: 'Demande enregistrée ✔', esito_errore: 'Erreur inattendue',
    prom_result: 'Rappels envoyés : {0} (ignorés : {1})', inviato: 'envoyé',
    h_andamento: 'Évolution des demandes (14 jours)',
    kpi_oggi_richieste: "Demandes aujourd'hui", kpi_oggi_appuntamenti: "Rendez-vous aujourd'hui", kpi_prossimi24h: 'Rendez-vous sous 24h',
    lbl_cerca: 'Rechercher (nom ou téléphone)', opt_tutti: 'Tous',
    btn_export: 'Exporter CSV', th_azioni: 'Actions',
    btn_fissa: 'Fixer un RDV', btn_conferma: 'Confirmer', btn_annulla: 'Annuler',
    toast_appuntamento_ok: 'Rendez-vous fixé', toast_stato_ok: 'Statut mis à jour', toast_errore: 'Opération échouée',
    tab_promemoria: 'Rappels', lbl_finestra: 'Fenêtre temporelle', h_da_avvisare: 'Rendez-vous à notifier',
    th_contatto: 'Contact',
    opt_f24: 'Sous 24 heures', opt_f48: 'Sous 48 heures', opt_f72: 'Sous 72 heures', opt_f168: 'Sous 7 jours',
    prom_hint: 'Coche les rendez-vous à notifier ; si tu ne coches rien, tous ceux listés seront notifiés.',
  },
};

let lang = 'it';
try { lang = localStorage.getItem('sf_lang') || 'it'; } catch { /* storage non disponibile */ }

// Restituisce la traduzione di una chiave; {0},{1}... sono sostituiti dagli argomenti.
function t(key, ...args) {
  let s = (I18N[lang] && I18N[lang][key]) || I18N.it[key] || key;
  args.forEach((a, i) => { s = s.replace('{' + i + '}', a); });
  return s;
}

// Applica le traduzioni a tutti gli elementi con data-i18n e aggiorna il bottone.
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    // Per le <label> che contengono un campo, traduciamo solo il primo nodo di testo.
    const primoTesto = el.childNodes[0];
    if (el.tagName === 'LABEL' && primoTesto && primoTesto.nodeType === Node.TEXT_NODE) {
      primoTesto.textContent = t(el.dataset.i18n) + ' ';
    } else {
      el.textContent = t(el.dataset.i18n);
    }
  });
  // L'opzione "Tutte" del filtro sede è generata in JS: la aggiorniamo a parte.
  document.querySelectorAll('#filtro-sede option[value=""], #prom-sede option[value=""]')
    .forEach((o) => { o.textContent = t('opt_tutte'); });
  document.documentElement.lang = lang;
  const btn = $('#btn-lang');
  btn.textContent = lang === 'it' ? 'FR' : 'IT';
  btn.title = lang === 'it' ? 'Tradurre in francese' : 'Traduci in italiano';
}

// --- Navigazione a schede --------------------------------------------------
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $('#' + btn.dataset.tab).classList.add('active');
  });
});

// --- 1) Cattura dell'utm_source dall'URL -----------------------------------
// Esempio: apri la pagina con ?utm_source=meta per simulare un arrivo da Meta.
function catturaUtm() {
  const utm = new URLSearchParams(window.location.search).get('utm_source');
  const canaliValidi = ['google', 'meta', 'instagram', 'referral', 'diretto'];
  if (utm && canaliValidi.includes(utm)) {
    $('#sel-canale').value = utm;           // preseleziona il canale nel form
    $('#utm-value').textContent = utm;
    $('#utm-banner').hidden = false;
  }
}

// --- Sedi (riempie i menu a tendina) ---------------------------------------
async function caricaSedi() {
  const sedi = await api('/api/sedi');
  const opt = (s) => `<option value="${s.id}">${s.nome} (${s.citta})</option>`;
  $('#sel-sede-form').innerHTML = sedi.map(opt).join('');
  const tutte = `<option value="">${t('opt_tutte')}</option>`;
  $('#filtro-sede').innerHTML = tutte + sedi.map(opt).join('');
  $('#prom-sede').innerHTML = tutte + sedi.map(opt).join('');
}

// --- 2) Dashboard / KPI ----------------------------------------------------
async function caricaStats() {
  const d = await api('/api/stats');

  const totInAttesa = d.richieste_in_attesa_oltre_2_giorni.length;
  const totConv = d.conversione_per_canale.reduce((a, c) => a + c.con_appuntamento, 0);
  const totRich = d.conversione_per_canale.reduce((a, c) => a + c.richieste, 0);
  const tassoMedio = totRich ? ((100 * totConv) / totRich).toFixed(1) : '0';

  const o = d.riepilogo_oggi;
  $('#riepilogo-cards').innerHTML = `
    <div class="card"><div class="value">${o.richieste_oggi}</div><div class="label">${t('kpi_oggi_richieste')}</div></div>
    <div class="card"><div class="value">${o.appuntamenti_oggi}</div><div class="label">${t('kpi_oggi_appuntamenti')}</div></div>
    <div class="card"><div class="value">${o.appuntamenti_prossimi_24h}</div><div class="label">${t('kpi_prossimi24h')}</div></div>`;

  $('#kpi-cards').innerHTML = `
    <div class="card"><div class="value">${totRich}</div><div class="label">${t('kpi_tot_richieste')}</div></div>
    <div class="card"><div class="value">${totConv}</div><div class="label">${t('kpi_convertite')}</div></div>
    <div class="card"><div class="value">${tassoMedio}%</div><div class="label">${t('kpi_tasso_medio')}</div></div>
    <div class="card"><div class="value">${totInAttesa}</div><div class="label">${t('kpi_in_attesa')}</div></div>`;

  renderGrafico(d.andamento_richieste);

  $('#tab-conversione tbody').innerHTML = d.conversione_per_canale
    .map((r) => `<tr><td>${r.canale}</td><td>${r.richieste}</td><td>${r.con_appuntamento}</td><td>${r.tasso_conversione}%</td></tr>`)
    .join('');

  $('#tab-costo tbody').innerHTML = d.costo_per_appuntamento
    .map((r) => {
      const costo = r.costo_per_appuntamento == null ? '—' : `€ ${r.costo_per_appuntamento}`;
      return `<tr><td>${r.canale}</td><td>€ ${r.spesa_totale}</td><td>${r.appuntamenti}</td><td>${costo}</td></tr>`;
    })
    .join('');

  $('#tab-attesa tbody').innerHTML = d.richieste_in_attesa_oltre_2_giorni
    .map((r) => `<tr><td>${r.nome}</td><td>${r.canale}</td><td>${r.sede_nome}</td><td>${r.stato}</td><td>${r.giorni_attesa}</td></tr>`)
    .join('');
}

// --- 3) Richieste ----------------------------------------------------------
const STATI = ['nuova', 'contattata', 'in_attesa', 'convertita', 'persa'];

// Raccoglie i filtri correnti in una query string (riusata anche dall'export CSV).
function queryRichieste() {
  const params = new URLSearchParams();
  const sede = $('#filtro-sede').value;
  const periodo = $('#filtro-periodo').value;
  const canale = $('#filtro-canale').value;
  const stato = $('#filtro-stato').value;
  const q = $('#filtro-q').value.trim();
  if (sede) params.set('sede', sede);
  if (periodo) params.set('periodo', periodo);
  if (canale) params.set('canale', canale);
  if (stato) params.set('stato', stato);
  if (q) params.set('q', q);
  return params;
}

async function caricaRichieste() {
  const righe = await api('/api/richieste?' + queryRichieste().toString());
  $('#tab-richieste tbody').innerHTML = righe
    .map((r) => {
      const options = STATI.map(
        (s) => `<option value="${s}" ${s === r.stato ? 'selected' : ''}>${s}</option>`
      ).join('');
      // Se già convertita non riproponiamo "fissa appuntamento".
      const azione = r.stato === 'convertita'
        ? '<span class="chart-label">—</span>'
        : `<button class="btn-mini btn-fissa" data-id="${r.id}">${t('btn_fissa')}</button>`;
      return `<tr data-id="${r.id}">
        <td>${esc(r.nome)}</td><td>${esc(r.telefono)}</td><td>${esc(r.sede_nome)}</td>
        <td><span class="pill">${r.canale}</span></td><td>${r.trattamento}</td>
        <td><select class="stato-select" data-id="${r.id}">${options}</select></td>
        <td>${fmtData(r.creata_il)}</td>
        <td class="cella-azione">${azione}</td>
      </tr>`;
    })
    .join('');

  // Cambio di stato -> PATCH
  document.querySelectorAll('#tab-richieste .stato-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await api('/api/richieste/' + sel.dataset.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stato: sel.value }),
        });
        toast(t('toast_stato_ok'));
        caricaStats();
      } catch (e) {
        toast((e.errors ? e.errors.join(', ') : t('toast_errore')), 'err');
      }
    });
  });

  // "Fissa appuntamento" -> mostra un mini-form inline con data/ora.
  document.querySelectorAll('#tab-richieste .btn-fissa').forEach((btn) => {
    btn.addEventListener('click', () => apriFissaAppuntamento(btn));
  });
}

// Valore di default: domani alle 10:00 (formato per <input datetime-local>).
function defaultDataOra() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(10, 0, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function apriFissaAppuntamento(btn) {
  const id = btn.dataset.id;
  const cella = btn.closest('.cella-azione');
  cella.innerHTML = `
    <span class="inline-schedule">
      <input type="datetime-local" class="ap-data" value="${defaultDataOra()}" />
      <button class="btn-mini ap-ok">${t('btn_conferma')}</button>
      <button class="btn-mini ap-no">${t('btn_annulla')}</button>
    </span>`;
  cella.querySelector('.ap-no').addEventListener('click', caricaRichieste);
  cella.querySelector('.ap-ok').addEventListener('click', async () => {
    const dataOra = cella.querySelector('.ap-data').value;
    if (!dataOra) return;
    try {
      await api('/api/appuntamenti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ richiesta_id: Number(id), data_ora: dataOra }),
      });
      toast(t('toast_appuntamento_ok'));
      await Promise.all([caricaRichieste(), caricaAppuntamenti(), caricaStats()]);
    } catch (e) {
      toast((e.errors ? e.errors.join(', ') : t('toast_errore')), 'err');
    }
  });
}

$('#filtro-sede').addEventListener('change', caricaRichieste);
$('#filtro-periodo').addEventListener('change', caricaRichieste);
$('#filtro-canale').addEventListener('change', caricaRichieste);
$('#filtro-stato').addEventListener('change', caricaRichieste);
// Ricerca testuale con piccolo ritardo (debounce) per non interrogare a ogni tasto.
let timerRicerca;
$('#filtro-q').addEventListener('input', () => {
  clearTimeout(timerRicerca);
  timerRicerca = setTimeout(caricaRichieste, 300);
});
// Export CSV: apre l'endpoint con i filtri correnti.
$('#btn-export').addEventListener('click', () => {
  window.location = '/api/richieste/export.csv?' + queryRichieste().toString();
});

// Invio del form di nuova richiesta
$('#form-richiesta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const esito = $('#form-esito');
  const body = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api('/api/richieste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    esito.textContent = t('esito_registrata');
    esito.className = 'esito ok';
    e.target.reset();
    catturaUtm();          // ripristina il canale da utm se presente
    caricaRichieste();
    caricaStats();
  } catch (err) {
    esito.textContent = (err.errors || [t('esito_errore')]).join(' · ');
    esito.className = 'esito err';
  }
});

// --- 4) Appuntamenti (sola lista con gestione stato) -----------------------
const STATI_APP = ['programmato', 'confermato', 'completato', 'annullato'];

async function caricaAppuntamenti() {
  const righe = await api('/api/appuntamenti');
  $('#tab-appuntamenti tbody').innerHTML = righe
    .map((a) => {
      const prom = a.promemoria_inviato ? '✔ ' + t('inviato') : '—';
      const options = STATI_APP.map(
        (s) => `<option value="${s}" ${s === a.stato ? 'selected' : ''}>${s}</option>`
      ).join('');
      return `<tr>
        <td>${fmtData(a.data_ora)}</td><td>${esc(a.nome)}</td><td>${esc(a.telefono)}</td>
        <td>${esc(a.sede_nome)}</td>
        <td><select class="stato-app-select" data-id="${a.id}">${options}</select></td>
        <td>${prom}</td>
      </tr>`;
    })
    .join('');

  // Cambio di stato dell'appuntamento -> PATCH
  document.querySelectorAll('.stato-app-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await api('/api/appuntamenti/' + sel.dataset.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stato: sel.value }),
        });
        toast(t('toast_stato_ok'));
        caricaStats();
        caricaPromemoria(); // l'idoneità al promemoria può cambiare
      } catch (e) {
        toast((e.errors ? e.errors.join(', ') : t('toast_errore')), 'err');
      }
    });
  });
}

// --- 5) Promemoria (pagina dedicata con filtri) ----------------------------
function queryPromemoria() {
  const params = new URLSearchParams({ da_avvisare: '1' });
  if ($('#prom-sede').value) params.set('sede', $('#prom-sede').value);
  if ($('#prom-finestra').value) params.set('entro_ore', $('#prom-finestra').value);
  return params;
}

async function caricaPromemoria() {
  const righe = await api('/api/appuntamenti?' + queryPromemoria().toString());
  $('#tab-promemoria tbody').innerHTML = righe
    .map((a) => {
      const contatto = [a.telefono, a.email].filter(Boolean).map(esc).join(' · ');
      return `<tr>
        <td><input type="checkbox" class="sel-app" value="${a.id}" /></td>
        <td>${fmtData(a.data_ora)}</td><td>${esc(a.nome)}</td>
        <td>${contatto}</td><td>${esc(a.sede_nome)}</td>
      </tr>`;
    })
    .join('');
  $('#sel-tutti').checked = false;
}

$('#prom-sede').addEventListener('change', caricaPromemoria);
$('#prom-finestra').addEventListener('change', caricaPromemoria);

// "Seleziona tutti"
$('#sel-tutti').addEventListener('change', (e) => {
  document.querySelectorAll('#tab-promemoria .sel-app').forEach((c) => { c.checked = e.target.checked; });
});

$('#btn-promemoria').addEventListener('click', async () => {
  const esito = $('#prom-esito');
  const spuntati = [...document.querySelectorAll('#tab-promemoria .sel-app:checked')].map((c) => Number(c.value));
  // Se nessuna casella è spuntata, avvisiamo tutti gli appuntamenti elencati (filtrati).
  const tutti = [...document.querySelectorAll('#tab-promemoria .sel-app')].map((c) => Number(c.value));
  const ids = spuntati.length > 0 ? spuntati : tutti;
  if (ids.length === 0) {
    esito.textContent = t('prom_result', 0, 0);
    esito.className = 'esito';
    return;
  }
  try {
    const r = await api('/api/promemoria/esegui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canale: $('#prom-canale').value, ids }),
    });
    esito.textContent = t('prom_result', r.inviati, r.saltati.length);
    esito.className = 'esito ok';
    await Promise.all([caricaPromemoria(), caricaAppuntamenti(), caricaStats()]);
  } catch (err) {
    esito.textContent = (err.errors || [t('esito_errore')]).join(' · ');
    esito.className = 'esito err';
  }
});

// --- Bottone di traduzione "a caldo" ---------------------------------------
$('#btn-lang').addEventListener('click', async () => {
  lang = lang === 'it' ? 'fr' : 'it';
  try { localStorage.setItem('sf_lang', lang); } catch { /* ignora */ }
  applyI18n();                       // etichette statiche
  catturaUtm();                      // banner utm
  // Ricarichiamo i contenuti generati (KPI, tabelle) nella nuova lingua.
  await Promise.all([caricaStats(), caricaRichieste(), caricaAppuntamenti(), caricaPromemoria()]);
});

// --- Avvio -----------------------------------------------------------------
async function init() {
  applyI18n();                       // applica la lingua salvata
  catturaUtm();
  await caricaSedi();
  await Promise.all([caricaStats(), caricaRichieste(), caricaAppuntamenti(), caricaPromemoria()]);
}
init().catch((e) => console.error('Errore di inizializzazione', e));
