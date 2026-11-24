// Pagina di prenotazione cliente: mostra gli slot liberi/occupati e permette
// di prenotare uno slot libero. Nessuna dipendenza esterna.

const $ = (sel) => document.querySelector(sel);

// --- Traduzioni (IT / FR) --------------------------------------------------
const I18N = {
  it: {
    tagline: 'Prenota il tuo appuntamento online',
    lbl_sede: 'Scegli la sede',
    leg_libero: 'libero', leg_occupato: 'riservato',
    leg_istruzione: 'tocca uno slot libero per prenotare.',
    vuoto: 'Nessuno slot disponibile per questa sede nei prossimi giorni.',
    modal_titolo: 'Conferma prenotazione',
    lbl_nome: 'Nome e cognome', lbl_telefono: 'Telefono',
    lbl_email: 'Email (opzionale)', lbl_trattamento: 'Trattamento',
    tr_controllo: 'controllo', tr_igiene: 'igiene', tr_ortodonzia: 'ortodonzia',
    tr_implantologia: 'implantologia', tr_sbiancamento: 'sbiancamento', tr_estetica: 'estetica',
    btn_annulla: 'Annulla', btn_conferma: 'Conferma',
    successo_titolo: 'Prenotazione confermata!',
    btn_altro: 'Prenota un altro appuntamento',
    caricamento: 'Caricamento…', invio: 'Invio…',
    alle: 'alle', errore_caricamento: 'Errore nel caricamento',
    successo_testo: '{0}, il tuo appuntamento del {1} presso {2} è stato registrato.',
  },
  fr: {
    tagline: 'Réservez votre rendez-vous en ligne',
    lbl_sede: 'Choisissez le cabinet',
    leg_libero: 'libre', leg_occupato: 'réservé',
    leg_istruzione: 'appuyez sur un créneau libre pour réserver.',
    vuoto: 'Aucun créneau disponible pour ce cabinet dans les prochains jours.',
    modal_titolo: 'Confirmation de réservation',
    lbl_nome: 'Nom et prénom', lbl_telefono: 'Téléphone',
    lbl_email: 'Email (optionnel)', lbl_trattamento: 'Soin',
    tr_controllo: 'contrôle', tr_igiene: 'hygiène', tr_ortodonzia: 'orthodontie',
    tr_implantologia: 'implantologie', tr_sbiancamento: 'blanchiment', tr_estetica: 'esthétique',
    btn_annulla: 'Annuler', btn_conferma: 'Confirmer',
    successo_titolo: 'Réservation confirmée !',
    btn_altro: 'Prendre un autre rendez-vous',
    caricamento: 'Chargement…', invio: 'Envoi…',
    alle: 'à', errore_caricamento: 'Erreur lors du chargement',
    successo_testo: '{0}, votre rendez-vous du {1} au cabinet {2} a bien été enregistré.',
  },
};

let lang = 'it';
try { lang = localStorage.getItem('sf_lang') || 'it'; } catch { /* storage non disponibile */ }

function t(key, ...args) {
  let s = (I18N[lang] && I18N[lang][key]) || I18N.it[key] || key;
  args.forEach((a, i) => { s = s.replace('{' + i + '}', a); });
  return s;
}

// Formattatore delle date secondo la lingua corrente.
let fmtGiorno = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const primoTesto = el.childNodes[0];
    if (el.tagName === 'LABEL' && primoTesto && primoTesto.nodeType === Node.TEXT_NODE) {
      primoTesto.textContent = t(el.dataset.i18n) + ' ';
    } else {
      el.textContent = t(el.dataset.i18n);
    }
  });
  document.documentElement.lang = lang;
  fmtGiorno = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'it-IT',
    { weekday: 'long', day: 'numeric', month: 'short' });
  const btn = $('#btn-lang');
  btn.textContent = lang === 'it' ? 'FR' : 'IT';
  btn.title = lang === 'it' ? 'Tradurre in francese' : 'Traduci in italiano';
}

// --- Elementi --------------------------------------------------------------
const selSede = $('#sel-sede');
const calendario = $('#calendario');
const vuoto = $('#vuoto');
const overlay = $('#overlay');
const successo = $('#successo');
const formPrenota = $('#form-prenota');
const slotLabel = $('#slot-label');
const sedeLabel = $('#sede-label');
const esito = $('#prenota-esito');

let slotScelto = null;

function labelGiorno(data) {
  return fmtGiorno.format(new Date(`${data}T00:00:00`));
}

function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
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
  calendario.innerHTML = `<p class="hint">${t('caricamento')}</p>`;
  vuoto.hidden = true;
  try {
    const r = await fetch(`/api/disponibilita?sede=${encodeURIComponent(sedeId)}`);
    const dati = await r.json();
    if (!r.ok) throw new Error((dati.errors || ['errore']).join(', '));
    rendiCalendario(dati.giorni);
  } catch (e) {
    calendario.innerHTML = '';
    toast(`${t('errore_caricamento')}: ${e.message}`, 'err');
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
        btn.title = t('leg_occupato');
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
  slotLabel.textContent = `${labelGiorno(data)} ${t('alle')} ${ora}`;
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
  esito.textContent = t('invio');
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
    $('#successo-testo').textContent = t('successo_testo', dati.nome, slotLabel.textContent, dati.sede);
    successo.hidden = false;
  } catch (e) {
    esito.textContent = e.message;
    esito.className = 'esito err';
    if (/prenotat|disponibil|slot|réserv|dispon/i.test(e.message)) caricaDisponibilita();
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

// Bascule della lingua IT/FR (memorizzata, condivisa con l'app del personale).
$('#btn-lang').addEventListener('click', () => {
  lang = lang === 'it' ? 'fr' : 'it';
  try { localStorage.setItem('sf_lang', lang); } catch { /* ignora */ }
  applyI18n();
  // Ricostruisce il calendario per aggiornare le etichette dei giorni.
  if (selSede.value) caricaDisponibilita();
});

applyI18n();
caricaSedi();
