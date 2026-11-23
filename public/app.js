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
  $('#filtro-sede').innerHTML = '<option value="">Tutte</option>' + sedi.map(opt).join('');
}

// --- 2) Dashboard / KPI ----------------------------------------------------
async function caricaStats() {
  const d = await api('/api/stats');

  const totInAttesa = d.richieste_in_attesa_oltre_2_giorni.length;
  const totConv = d.conversione_per_canale.reduce((a, c) => a + c.con_appuntamento, 0);
  const totRich = d.conversione_per_canale.reduce((a, c) => a + c.richieste, 0);
  const tassoMedio = totRich ? ((100 * totConv) / totRich).toFixed(1) : '0';

  $('#kpi-cards').innerHTML = `
    <div class="card"><div class="value">${totRich}</div><div class="label">Richieste totali</div></div>
    <div class="card"><div class="value">${totConv}</div><div class="label">Convertite in appuntamento</div></div>
    <div class="card"><div class="value">${tassoMedio}%</div><div class="label">Tasso di conversione medio</div></div>
    <div class="card"><div class="value">${totInAttesa}</div><div class="label">In attesa da oltre 2 giorni</div></div>`;

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
    esito.textContent = 'Richiesta registrata ✔';
    esito.className = 'esito ok';
    e.target.reset();
    catturaUtm();          // ripristina il canale da utm se presente
    caricaRichieste();
    caricaStats();
  } catch (err) {
    esito.textContent = (err.errors || ['Errore imprevisto']).join(' · ');
    esito.className = 'esito err';
  }
});

// --- 4) Appuntamenti e promemoria ------------------------------------------
async function caricaAppuntamenti() {
  const righe = await api('/api/appuntamenti');
  $('#tab-appuntamenti tbody').innerHTML = righe
    .map((a) => {
      const prom = a.promemoria_inviato ? '✔ inviato' : '—';
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
    esito.textContent = `Promemoria inviati: ${r.inviati} (saltati: ${r.saltati.length})`;
    esito.className = 'esito ok';
    caricaAppuntamenti();
  } catch (err) {
    esito.textContent = (err.errors || ['Errore imprevisto']).join(' · ');
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

// --- Avvio -----------------------------------------------------------------
async function init() {
  catturaUtm();
  await caricaSedi();
  await Promise.all([caricaStats(), caricaRichieste(), caricaAppuntamenti()]);
}
init().catch((e) => console.error('Errore di inizializzazione', e));
