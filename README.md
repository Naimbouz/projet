# SmileFlow

Demo full-stack per la gestione delle **richieste di contatto**, degli
**appuntamenti** e dei **promemoria automatici** di una catena di studi
dentistici.

> ⚠️ Progetto dimostrativo. Tutti i dati sono **fittizi**: nessun dato reale di
> pazienti e nessun nome o logo di aziende reali.

## A cosa serve

- Raccoglie le richieste di contatto che arrivano dai canali di marketing
  (Google Ads, Meta, Instagram, passaparola…) registrando il **canale di
  provenienza** (`utm_source`).
- Mostra una **dashboard** con KPI reali: tasso di conversione per canale,
  costo per appuntamento, richieste in attesa da troppo tempo.
- Automatizza l'invio dei **promemoria** per gli appuntamenti imminenti
  (invio simulato su WhatsApp / SMS / email con registro).

## Tecnologie

| Ambito        | Scelta              | Perché |
|---------------|---------------------|--------|
| Server        | **Node.js + Express** | Standard, routing semplice e leggibile |
| Database      | **SQLite** (`node:sqlite`) | Modulo nativo di Node 24: nessuna installazione né compilazione |
| Front-end     | **HTML/CSS/JS** puro | Nessun framework, chiamate via `fetch` |
| Test          | **`node --test`**    | Runner integrato, nessuna dipendenza aggiuntiva |

**Un'unica dipendenza esterna: Express.** Il database usa la libreria standard
di Node.

## Requisiti

- Node.js **22.5+** (consigliato 24) — serve il modulo `node:sqlite`.

## Installazione e avvio

```bash
npm install        # installa Express
npm run seed       # crea e popola il database con dati fittizi
npm start          # avvia il server su http://localhost:3000
```

Poi apri **http://localhost:3000** nel browser.

Per simulare un arrivo da un canale di marketing, aggiungi il parametro
`utm_source` all'URL, ad esempio:
`http://localhost:3000/?utm_source=meta` → il canale viene pre-compilato nel
modulo di richiesta.

### Test

```bash
npm test
```

## Struttura del progetto

```
schema.sql        definizione delle tabelle (vincoli e chiavi esterne)
db.js             connessione al database + attivazione chiavi esterne
seed.js           dati di test fittizi
validation.js     validazione degli input (funzioni pure)
stats.js          query SQL dei KPI
reminders.js      automazione dei promemoria
server.js         server Express e rotte API
public/           front-end (index.html, style.css, app.js)
test/             test con node --test
docs/workflow.md  workflow di automazione in stile n8n
```

## API REST

| Metodo | Endpoint                     | Descrizione |
|--------|------------------------------|-------------|
| GET    | `/api/sedi`                  | Elenco delle sedi |
| POST   | `/api/richieste`             | Registra una richiesta (validazione lato server) |
| GET    | `/api/richieste`             | Elenco con filtri `sede` e `periodo` (giorni) |
| PATCH  | `/api/richieste/:id`         | Aggiorna lo `stato` della richiesta |
| GET    | `/api/stats`                 | KPI: conversione per canale, costo per appuntamento, richieste in attesa |
| GET    | `/api/appuntamenti`          | Elenco appuntamenti (filtro opzionale `entro_ore`) |
| POST   | `/api/promemoria/esegui`     | Lancia l'automazione dei promemoria |

### Esempi

```bash
# Nuova richiesta
curl -X POST http://localhost:3000/api/richieste \
  -H "Content-Type: application/json" \
  -d '{"nome":"Mario Rossi","telefono":"+378 333 1234567","sede_id":1,"canale":"google","trattamento":"igiene"}'

# Richieste di una sede negli ultimi 30 giorni
curl "http://localhost:3000/api/richieste?sede=1&periodo=30"

# Esegui i promemoria per gli appuntamenti entro 24h via WhatsApp
curl -X POST http://localhost:3000/api/promemoria/esegui \
  -H "Content-Type: application/json" \
  -d '{"ore_prima":24,"canale":"whatsapp"}'
```

## Modello dati

- **sedi** — gli studi della catena.
- **richieste** — i lead: nome, telefono, sede, `canale` (utm_source),
  trattamento, stato, costo di acquisizione.
- **appuntamenti** — gli appuntamenti fissati a partire da una richiesta.
- **promemoria_log** — registro dei promemoria inviati dall'automazione.

Le chiavi esterne sono attive e i valori di `canale`, `trattamento` e `stato`
sono limitati da vincoli `CHECK`.

## Automazione dei promemoria

Il flusso (trigger → filtro → invio → aggiornamento CRM) è descritto in
[`docs/workflow.md`](docs/workflow.md). L'invio è **simulato** (scrive nel log
e sulla console) per non contattare persone reali; in produzione si
collegherebbe un provider reale (WhatsApp Business API, Twilio, SMTP).

## Limiti noti

- `node:sqlite` è una funzionalità **sperimentale** di Node: all'avvio compare
  un avviso. È adatta a una demo, non ancora a un ambiente di produzione critico.
- Invio dei promemoria **simulato**: nessun messaggio reale viene inviato.
- Nessuna autenticazione/autorizzazione (fuori dallo scopo della demo).
- I KPI di costo usano un costo di acquisizione indicativo per lead, non dati
  reali delle piattaforme pubblicitarie.

## Prossimi passi

- Integrazione reale con WhatsApp/SMS/email e con un CRM.
- Import automatico delle spese da Google Ads e Meta per KPI di costo precisi.
- Autenticazione degli operatori e gestione dei ruoli.
- Secondo promemoria e gestione delle risposte dei pazienti.
- Migrazione a un database di produzione (es. PostgreSQL) e deploy.
