# Workflow di automazione dei promemoria (stile n8n)

Questo documento descrive l'automazione dei promemoria appuntamenti come
sarebbe costruita in uno strumento no-code/low-code (es. **n8n**, Make, Zapier).
Nel progetto l'automazione è già implementata lato server
(`reminders.js` + `POST /api/promemoria/esegui`); qui mostriamo come si
collegherebbe a un orchestratore esterno e a un CRM reale.

## Schema del flusso

```
┌──────────────┐   ┌───────────────────┐   ┌───────────────────┐   ┌──────────────────┐
│ 1. TRIGGER   │   │ 2. FILTRO         │   │ 3. INVIO          │   │ 4. AGGIORNA CRM  │
│ Schedule     │──▶│ Appuntamenti      │──▶│ WhatsApp / SMS /  │──▶│ promemoria_inv.  │
│ (ogni ora)   │   │ tra ora e +24h    │   │ Email (per riga)  │   │ = 1 + log        │
│ Cron         │   │ e non già avvisati│   │                   │   │                  │
└──────────────┘   └───────────────────┘   └───────────────────┘   └──────────────────┘
```

## Nodo per nodo

### 1. Trigger — Schedule (Cron)
- **Tipo:** nodo "Schedule Trigger".
- **Frequenza:** ogni ora (`0 * * * *`).
- **Scopo:** avviare periodicamente il controllo senza intervento umano.

### 2. Filtro — selezione degli appuntamenti
- **Tipo:** nodo "HTTP Request" verso `GET /api/appuntamenti?entro_ore=24`
  oppure query SQL diretta.
- **Condizioni (già applicate dalla query):**
  - stato `programmato` o `confermato`;
  - `promemoria_inviato = 0` (non ancora avvisato → niente doppioni);
  - `data_ora` compresa tra adesso e adesso + N ore.

### 3. Invio — messaggio al paziente
- **Tipo:** nodo del provider (WhatsApp Business API, Twilio SMS, SMTP email).
- **Selezione del canale:** parametro `canale` (whatsapp | sms | email).
- **Destinatario:** telefono per whatsapp/sms, email per il canale email.
- **Messaggio (template):**
  > Gentile {{nome}}, le ricordiamo il suo appuntamento presso {{sede}}
  > il {{data_ora}}. Risponda per confermare.
- **Nota:** nella demo l'invio è **simulato** (log su console), per non
  contattare persone reali.

### 4. Aggiornamento del CRM
- **Tipo:** nodo "HTTP Request" / "Database".
- **Azioni:**
  - inserire una riga in `promemoria_log` (canale, destinatario, messaggio, data);
  - impostare `appuntamenti.promemoria_inviato = 1`.
- **Effetto:** l'esecuzione è **idempotente** — al giro successivo lo stesso
  appuntamento viene escluso dal filtro.

## Corrispondenza con il codice del progetto

| Passo del workflow        | Implementazione nel progetto                          |
|---------------------------|-------------------------------------------------------|
| Trigger (schedule)        | chiamata manuale o cron a `POST /api/promemoria/esegui` |
| Filtro appuntamenti       | `appuntamentiDaRicordare()` in `reminders.js`         |
| Invio messaggio           | `inviaMessaggioSimulato()` (da sostituire col provider) |
| Aggiornamento CRM + log   | `INSERT promemoria_log` + `UPDATE promemoria_inviato` |

## Estensioni possibili
- Secondo promemoria a 2 ore dall'appuntamento.
- Gestione delle risposte ("CONFERMO" → stato `confermato`).
- Ritentare l'invio in caso di errore del provider.
- Report giornaliero dei promemoria inviati per sede.
