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
    lbl_password: 'Password', btn_entra: 'Entra', btn_logout: 'Esci', login_errore: 'Password errata',
    login_offline: "Server non raggiungibile. Avvia 'npm start' e apri http://localhost:3000",
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
    lbl_password: 'Mot de passe', btn_entra: 'Entrer', btn_logout: 'Déconnexion', login_errore: 'Mot de passe incorrect',
    login_offline: "Serveur injoignable. Lance 'npm start' et ouvre http://localhost:3000",
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
  const primaOpt = document.querySelector('#filtro-sede option[value=""]');
  if (primaOpt) primaOpt.textContent = t('opt_tutte');
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
  $('#filtro-sede').innerHTML = `<option value="">${t('opt_tutte')}</option>` + sedi.map(opt).join('');
}

// --- 2) Dashboard / KPI ----------------------------------------------------
async function caricaStats() {
  const d = await api('/api/stats');

  const totInAttesa = d.richieste_in_attesa_oltre_2_giorni.length;
  const totConv = d.conversione_per_canale.reduce((a, c) => a + c.con_appuntamento, 0);
  const totRich = d.conversione_per_canale.reduce((a, c) => a + c.richieste, 0);
  const tassoMedio = totRich ? ((100 * totConv) / totRich).toFixed(1) : '0';

  $('#kpi-cards').innerHTML = `
    <div class="card"><div class="value">${totRich}</div><div class="label">${t('kpi_tot_richieste')}</div></div>
    <div class="card"><div class="value">${totConv}</div><div class="label">${t('kpi_convertite')}</div></div>
    <div class="card"><div class="value">${tassoMedio}%</div><div class="label">${t('kpi_tasso_medio')}</div></div>
    <div class="card"><div class="value">${totInAttesa}</div><div class="label">${t('kpi_in_attesa')}</div></div>`;

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

async function caricaRichieste() {
  const sede = $('#filtro-sede').value;
  const periodo = $('#filtro-periodo').value;
  const params = new URLSearchParams();
  if (sede) params.set('sede', sede);
  if (periodo) params.set('periodo', periodo);

  const righe = await api('/api/richieste?' + params.toString());
  $('#tab-richieste tbody').innerHTML = righe
    .map((r) => {
      const options = STATI.map(
        (s) => `<option value="${s}" ${s === r.stato ? 'selected' : ''}>${s}</option>`
      ).join('');
      return `<tr>
        <td>${r.nome}</td><td>${r.telefono}</td><td>${r.sede_nome}</td>
        <td><span class="pill">${r.canale}</span></td><td>${r.trattamento}</td>
        <td><select class="stato-select" data-id="${r.id}">${options}</select></td>
        <td>${fmtData(r.creata_il)}</td>
      </tr>`;
    })
    .join('');

  // Cambio di stato -> PATCH
  document.querySelectorAll('.stato-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await api('/api/richieste/' + sel.dataset.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stato: sel.value }),
        });
        caricaStats(); // i KPI possono cambiare
      } catch (e) {
        alert('Errore: ' + (e.errors ? e.errors.join(', ') : 'imprevisto'));
      }
    });
  });
}

$('#filtro-sede').addEventListener('change', caricaRichieste);
$('#filtro-periodo').addEventListener('change', caricaRichieste);

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

// --- 4) Appuntamenti e promemoria ------------------------------------------
async function caricaAppuntamenti() {
  const righe = await api('/api/appuntamenti');
  $('#tab-appuntamenti tbody').innerHTML = righe
    .map((a) => {
      const prom = a.promemoria_inviato ? '✔ ' + t('inviato') : '—';
      return `<tr>
        <td>${fmtData(a.data_ora)}</td><td>${a.nome}</td><td>${a.telefono}</td>
        <td>${a.sede_nome}</td><td>${a.stato}</td><td>${prom}</td>
      </tr>`;
    })
    .join('');
}

$('#btn-promemoria').addEventListener('click', async () => {
  const esito = $('#prom-esito');
  try {
    const r = await api('/api/promemoria/esegui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ore_prima: Number($('#prom-ore').value),
        canale: $('#prom-canale').value,
      }),
    });
    esito.textContent = t('prom_result', r.inviati, r.saltati.length);
    esito.className = 'esito ok';
    caricaAppuntamenti();
  } catch (err) {
    esito.textContent = (err.errors || [t('esito_errore')]).join(' · ');
    esito.className = 'esito err';
  }
});

// --- 5) Vista schema (tab Dati e SQL) --------------------------------------
$('#schema-view').textContent = `sedi(id, nome, citta, telefono)
richieste(id, nome, telefono, email, sede_id -> sedi,
          canale, trattamento, stato, costo_acquisizione, note, creata_il)
appuntamenti(id, richiesta_id -> richieste, sede_id -> sedi,
             data_ora, stato, promemoria_inviato, creato_il)
promemoria_log(id, appuntamento_id -> appuntamenti,
               canale, destinatario, messaggio, inviato_il)`;

// --- Bottone di traduzione "a caldo" ---------------------------------------
$('#btn-lang').addEventListener('click', async () => {
  lang = lang === 'it' ? 'fr' : 'it';
  try { localStorage.setItem('sf_lang', lang); } catch { /* ignora */ }
  applyI18n();                       // etichette statiche
  catturaUtm();                      // banner utm
  // Ricarichiamo i contenuti generati (KPI, tabelle) nella nuova lingua.
  await Promise.all([caricaStats(), caricaRichieste(), caricaAppuntamenti()]);
});

// --- Autenticazione (schermata di login) -----------------------------------
function mostraLogin() {
  $('#login-screen').hidden = false;
  $('#app').hidden = true;
}
function mostraApp() {
  $('#login-screen').hidden = true;
  $('#app').hidden = false;
}

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const esito = $('#login-esito');
  esito.className = 'esito';
  esito.textContent = '';

  let res;
  try {
    res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('#login-password').value }),
    });
  } catch {
    // fetch fallisce = nessun server risponde (es. pagina aperta come file://).
    esito.textContent = t('login_offline');
    esito.className = 'esito err';
    return;
  }

  if (res.ok) {
    mostraApp();
    try { await init(); } catch (err) { console.error('Errore init', err); }
  } else {
    // Il server ha risposto ma rifiuta: password sbagliata.
    esito.textContent = t('login_errore');
    esito.className = 'esito err';
  }
});

$('#btn-logout').addEventListener('click', async () => {
  try { await fetch('/api/logout', { method: 'POST' }); } catch { /* ignora */ }
  location.reload();
});

// --- Avvio -----------------------------------------------------------------
async function init() {
  catturaUtm();
  await caricaSedi();
  await Promise.all([caricaStats(), caricaRichieste(), caricaAppuntamenti()]);
}

// Punto d'ingresso: controlla la sessione, poi mostra login o app.
async function avvio() {
  applyI18n();                       // traduce anche la schermata di login
  let autenticato = false;
  try {
    const s = await (await fetch('/api/session')).json();
    autenticato = s.authenticated;
  } catch { /* server non raggiungibile */ }

  if (autenticato) {
    mostraApp();
    await init();
  } else {
    mostraLogin();
  }
}
avvio().catch((e) => console.error('Errore di inizializzazione', e));
