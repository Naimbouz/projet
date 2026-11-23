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

### Funzioni per l'amministratore

- **Cruscotto** con riepilogo di oggi, **grafico** dell'andamento richieste
  (14 giorni) e KPI.
- **Ricerca e filtri** sulle richieste (testo, sede, periodo, canale, stato).
- **Esportazione CSV** delle richieste filtrate.
- **Fissare un appuntamento** da una richiesta (che diventa "convertita").
- **Pagina Promemoria dedicata**: ricerca per nome, filtri sede/finestra, selezione
  dei pazienti, invio **immediato** o **programmato** a una data/ora (uno scheduler
  invia i promemoria quando arriva l'ora).
- **Gestione dello stato** di richieste e appuntamenti.
- Interfaccia **bilingue IT/FR** e notifiche (toast).

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
| GET    | `/api/richieste`             | Elenco con filtri `sede`, `periodo`, `canale`, `stato`, `q` (ricerca) |
| GET    | `/api/richieste/export.csv`  | Esporta in CSV le richieste filtrate |
| PATCH  | `/api/richieste/:id`         | Aggiorna lo `stato` della richiesta |
| GET    | `/api/stats`                 | KPI: riepilogo di oggi, andamento 14 giorni, conversione, costo, in attesa |
| GET    | `/api/appuntamenti`          | Elenco appuntamenti (filtri `entro_ore`, `sede`, `q`, `da_avvisare`) |
| POST   | `/api/appuntamenti`          | Fissa un appuntamento da una richiesta (la marca "convertita") |
| PATCH  | `/api/appuntamenti/:id`      | Aggiorna lo `stato` dell'appuntamento |
| POST   | `/api/promemoria/esegui`     | Invia subito i promemoria (per id o per finestra oraria) |
| POST   | `/api/promemoria/programma`  | Programma l'invio dei promemoria a una data/ora futura |
| GET    | `/api/promemoria/programmati`| Elenco dei promemoria programmati in attesa |

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
[`docs/workflow.md`](docs/workflow.md).

- **Email**: invio **reale** tramite [Brevo](https://www.brevo.com) (piano
  gratuito) se sono impostate le variabili d'ambiente, altrimenti simulato.
- **WhatsApp / SMS**: sempre **simulati** (scrivono nel log); si collegherebbero
  a un provider reale (WhatsApp Business API, Twilio).

### Invio email reale (Brevo)

1. Crea un account gratuito su brevo.com.
2. Verifica un **mittente** (es. la tua email) e genera una **API key**
   (SMTP & API → API Keys).
3. Copia `.env.example` in `.env` e compila:

   ```
   BREVO_API_KEY=xkeysib-...
   MITTENTE_EMAIL=tua-email-verificata@gmail.com
   MITTENTE_NOME=SmileFlow
   ```

4. Avvia con `npm start` (carica `.env` automaticamente) e lancia i promemoria
   sul canale **email**. Riceverà l'email il paziente il cui indirizzo è nella
   richiesta (usa una richiesta con un'email reale per provare).

## Limiti noti

- `node:sqlite` è una funzionalità **sperimentale** di Node: all'avvio compare
  un avviso. È adatta a una demo, non ancora a un ambiente di produzione critico.
- Promemoria: email **reali** via Brevo se configurato; WhatsApp/SMS restano
  **simulati** (non esistono servizi SMS realmente gratuiti).
- Nessuna autenticazione/autorizzazione (fuori dallo scopo della demo).
- I KPI di costo usano un costo di acquisizione indicativo per lead, non dati
  reali delle piattaforme pubblicitarie.

## Prossimi passi

- Integrazione reale con WhatsApp/SMS/email e con un CRM.
- Import automatico delle spese da Google Ads e Meta per KPI di costo precisi.
- Autenticazione degli operatori e gestione dei ruoli.
- Secondo promemoria e gestione delle risposte dei pazienti.
- Migrazione a un database di produzione (es. PostgreSQL) e deploy.
