// Pagina di prenotazione cliente: mostra gli slot liberi/occupati e permette
// di prenotare uno slot libero. Nessuna dipendenza esterna.

const $ = (sel) => document.querySelector(sel);

const selSede = $('#sel-sede');
const calendario = $('#calendario');
const vuoto = $('#vuoto');
const overlay = $('#overlay');
const successo = $('#successo');
const formPrenota = $('#form-prenota');
const slotLabel = $('#slot-label');
const sedeLabel = $('#sede-label');
const esito = $('#prenota-esito');

let slotScelto = null; // { data_ora, label }

const fmtGiorno = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });

function labelGiorno(data) {
  const d = new Date(`${data}T00:00:00`);
  return fmtGiorno.format(d);
}

function toast(msg, tipo = '') {
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

async function caricaSedi() {
  const r = await fetch('/api/sedi');
  const sedi = await r.json();
  selSede.innerHTML = sedi
    .map((s) => `<option value="${s.id}">${s.nome} — ${s.citta}</option>`)
    .join('');
  if (sedi.length) caricaDisponibilita();
}

async function caricaDisponibilita() {
  const sedeId = selSede.value;
  calendario.innerHTML = '<p class="hint">Caricamento…</p>';
  vuoto.hidden = true;
  try {
    const r = await fetch(`/api/disponibilita?sede=${encodeURIComponent(sedeId)}`);
    const dati = await r.json();
    if (!r.ok) throw new Error((dati.errors || ['errore']).join(', '));
    rendiCalendario(dati.giorni);
  } catch (e) {
    calendario.innerHTML = '';
    toast('Errore nel caricamento: ' + e.message, 'err');
  }
}

function rendiCalendario(giorni) {
  calendario.innerHTML = '';
  const conSlot = giorni.filter((g) => g.slots.length > 0);
  if (conSlot.length === 0) {
    vuoto.hidden = false;
    return;
  }
  vuoto.hidden = true;

  for (const g of conSlot) {
    const box = document.createElement('div');
    box.className = 'giorno';

    const titolo = document.createElement('h3');
    titolo.textContent = labelGiorno(g.data);
    box.appendChild(titolo);

    const grid = document.createElement('div');
    grid.className = 'slot-grid';
    for (const s of g.slots) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `slot ${s.stato}`;
      btn.textContent = s.ora;
      if (s.stato === 'occupato') {
        btn.disabled = true;
        btn.title = 'Riservato';
      } else {
        btn.addEventListener('click', () => apriConferma(s.data_ora, g.data, s.ora));
      }
      grid.appendChild(btn);
    }
    box.appendChild(grid);
    calendario.appendChild(box);
  }
}

function apriConferma(dataOra, data, ora) {
  slotScelto = { data_ora: dataOra };
  slotLabel.textContent = `${labelGiorno(data)} alle ${ora}`;
  sedeLabel.textContent = selSede.options[selSede.selectedIndex].textContent;
  esito.textContent = '';
  esito.className = 'esito';
  formPrenota.reset();
  overlay.hidden = false;
  formPrenota.nome.focus();
}

function chiudiConferma() {
  overlay.hidden = true;
  slotScelto = null;
}

formPrenota.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!slotScelto) return;
  const btn = formPrenota.querySelector('button[type=submit]');
  btn.disabled = true;
  esito.textContent = 'Invio…';
  esito.className = 'esito';

  const corpo = {
    sede_id: Number(selSede.value),
    data_ora: slotScelto.data_ora,
    nome: formPrenota.nome.value,
    telefono: formPrenota.telefono.value,
    email: formPrenota.email.value || null,
    trattamento: formPrenota.trattamento.value,
  };

  try {
    const r = await fetch('/api/prenota', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const dati = await r.json();
    if (!r.ok) throw new Error((dati.errors || ['errore']).join(', '));

    overlay.hidden = true;
    $('#successo-testo').textContent =
      `${dati.nome}, il tuo appuntamento del ${slotLabel.textContent} presso ${dati.sede} è stato registrato.`;
    successo.hidden = false;
  } catch (e) {
    esito.textContent = e.message;
    esito.className = 'esito err';
    // Se lo slot è stato preso nel frattempo, ricarica la disponibilità.
    if (/prenotat|disponibil|slot/i.test(e.message)) caricaDisponibilita();
  } finally {
    btn.disabled = false;
  }
});

$('#btn-annulla').addEventListener('click', chiudiConferma);
overlay.addEventListener('click', (e) => { if (e.target === overlay) chiudiConferma(); });
$('#btn-chiudi').addEventListener('click', () => {
  successo.hidden = true;
  caricaDisponibilita();
});
selSede.addEventListener('change', caricaDisponibilita);

caricaSedi();
