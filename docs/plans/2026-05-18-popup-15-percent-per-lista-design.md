# Popup 15% per-lista — Design

Data: 2026-05-18

## Obiettivo

Allineare il popup "Numero esiti massimi raggiunto" (che invita a smettere
di mettere esiti su Salesforce) al conteggio reale dei nominativi caricati.
Oggi il popup usa un campo fisso (`users.monthly_call_limit`) scollegato
dai nominativi della campagna; vogliamo che il target sia il 15% della
**lista attiva** dell'operatrice e che il conteggio riparta da 0 a ogni
nuova lista caricata.

## Requisiti utente

- Il popup deve apparire quando l'operatrice raggiunge il 15% della
  sua lista corrente.
- Quando il superadmin carica una nuova lista, il popup deve sparire
  e il conteggio ripartire da 0.
- Quando l'operatrice raggiunge il 15% della nuova lista, il popup
  riappare.
- Aggiungere alla pagina operatrice una barra di avanzamento con
  contatori (esiti fatti / target / da fare).
- `monthly_call_limit` resta come override manuale del superadmin.

## Decisioni di design

### Logica del target

Per ogni operatrice, al render della pagina:

```text
if (user.monthly_call_limit IS NOT NULL):
    target = user.monthly_call_limit
    conteggio = call_outcomes del mese in corso
    sorgente = 'override'
else if (esiste almeno un campaign_entry per quella user_id):
    lista_attiva = campaign_entry più recente per created_at
    target = ceil(lista_attiva.count × 0.15)
    conteggio = COUNT(call_outcomes WHERE user_id = me
                       AND created_at > lista_attiva.created_at)
    sorgente = 'lista'
else:
    target = null
    sorgente = 'nessuna'
```

Il popup appare se `target IS NOT NULL AND conteggio >= target`.

### Per-lista, non per-mese

Per ogni operatrice, la **lista attiva** è l'ultima riga di
`campaign_entries` per `created_at`. Caricare una nuova riga sposta il
"riferimento": il `created_at` della nuova entry diventa il punto di
partenza per il conteggio, quindi tutte le `call_outcomes` precedenti
non contano per la nuova lista.

Se ci sono più liste nello stesso giorno, vince sempre la più recente.

Se un superadmin cancella la lista attiva, la penultima torna ad essere
attiva al prossimo refresh.

### Refresh comportamento

Aggiungo `revalidatePath('/operatore')` dentro le server action
`recordOutcome` e `createAppointment`. Effetto:

- Tu carichi una nuova lista alle 14:00.
- L'operatrice è ancora sulla pagina con popup mostrato.
- Alle 14:01 lei clicca un esito (NON RISPONDE / NEGATIVO / APPUNTAMENTO).
- La server action salva l'esito e revalida la pagina.
- Il render prende la nuova lista come attiva → target nuovo,
  conteggio = 0 + 1 (l'esito appena fatto) → popup sparisce, barra
  mostra `1 / target`.

L'optimistic update del DailyCounter continua a funzionare come oggi
(stato React aggiornato istantaneamente prima della revalidazione).

### UI: card "Lista corrente"

Sopra al `DailyCounter` esistente, aggiungo una nuova card visibile
solo se `target !== null`:

```
┌─────────────────────────────────────────────────┐
│  LISTA CORRENTE                                 │
│  ──────────────────────                         │
│  45 / 75 esiti su Salesforce  ·  30 da fare    │
│  ████████████████░░░░░░░░░░  60%                │
│                                                 │
│  Nominativi caricati: 500  · Caricato il 18/05  │
└─────────────────────────────────────────────────┘
```

Colori della barra:
- verde (`from-emerald-400 to-emerald-500`) se sotto 50%
- ambra (`from-amber-400 to-amber-500`) se 50-80%
- rossa (`from-red-400 to-red-500`) se ≥ 80%

Quando il sorgente è `override`, mostriamo "Limite manuale" al posto
di "Nominativi caricati: N".

### Popup invariato come look, trigger nuovo

Il modale resta visivamente identico (gradient rosso, icona alert,
copy "Numero Esiti massimi raggiunto"). Cambia solo il dato
sottostante:

- Trigger ora è `conteggio >= target` (con `target` per-lista o
  override come da logica sopra)
- Il numero mostrato dentro il popup è `conteggio / target`
- Dismiss: come oggi, click su "Ho capito" chiude la modal locale.
  Riappare al prossimo refresh se il conteggio è ancora ≥ target.

## Scope

**In scope**
- `src/app/operatore/page.tsx`: nuova query per `campaign_entries` +
  conteggio per-lista
- `src/app/operatore/OperatorPageClient.tsx`: card lista corrente, nuovo
  trigger popup, props nuove (`target`, `conteggio`, `sorgente`,
  `lista`)
- `src/app/operatore/actions.ts`: `revalidatePath('/operatore')` in
  `recordOutcome` e `createAppointment`
- `src/lib/types.ts`: tipo `CurrentListaInfo`

**Fuori scope**
- Vista admin di "lista attiva per operatrice"
- Real-time push (l'auto-aggiornamento avviene solo al click di esito)
- Modifica alla KPI page (che resta su 15% del totale mensile dei
  nominativi)
- Modifica al popup visivo (resta identico)

## Rischi

- **Operatrice che dismissa il popup e continua a chiamare**:
  comportamento attuale già accettato; il popup non blocca, è solo un
  avviso. Si rivede al prossimo refresh.
- **Liste piccole con `count < 7`**: target = 1, popup al primo
  esito. Se diventa fastidioso, possiamo aggiungere
  `Math.max(target, 5)` come pavimento minimo. Non lo facciamo ora.
- **Multiple liste nello stesso secondo**: ordinamento per `created_at`
  con tie-break per `id` (uuid) — accettabile, l'utente non può creare
  due liste contemporaneamente con la UI esistente.

## File coinvolti

- `src/app/operatore/page.tsx`
- `src/app/operatore/OperatorPageClient.tsx`
- `src/app/operatore/actions.ts`
- `src/lib/types.ts`
- Nessun cambio di schema DB (`campaign_entries` e `call_outcomes`
  bastano).
