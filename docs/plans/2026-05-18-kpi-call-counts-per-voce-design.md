# KPI — Conteggio chiamate per voce (lista) — Design

Data: 2026-05-18

## Obiettivo

Nella pagina `/admin/kpi`, quando il superadmin espande l'elenco delle
"voci" (campaign_entries) di un'operatrice, mostrare per ogni voce:

- numero chiamate associate a quella lista
- target = 15% del count della voce
- mini barra di avanzamento

Il totale mensile per operatrice (colonna `Chiamate (15%)`) resta
invariato. La novità è il dettaglio per-voce nella vista espansa.

## Requisiti utente

- Per ogni voce: numero chiamate fatte sulla lista, percentuale 15%,
  barra di avanzamento compatta
- Coerente con la logica per-lista del popup operatrice (intervallo
  temporale tra voci consecutive)
- Visibile solo quando l'utente espande l'elenco delle voci
  (`expandedEntries === op.operatorId`)

## Decisioni di design

### Attribuzione delle chiamate

Per ogni `campaign_entry` di un'operatrice:

```text
intervalStart = entry.created_at
intervalEnd   = min(
                   created_at della voce successiva della stessa
                       operatrice (per ordine cronologico),
                   fine del mese selezionato
                 )

entryCallCount = COUNT(call_outcomes
                   WHERE user_id = entry.user_id
                   AND   created_at >= intervalStart
                   AND   created_at <  intervalEnd)

entryTarget = ceil(entry.count * 0.15)
```

Lo stesso modello "intervallo temporale" usato dal popup 15% per-lista
sul lato operatrice → consistenza.

Le voci sono già ordinate `created_at ASC` nel componente
(`KpiPageClient.tsx`); per il calcolo dell'intervallo basta scorrere la
lista ordinata di voci dell'operatrice.

### Backend

`src/app/admin/kpi/page.tsx` estende il calcolo `operatorStats` con un
campo `callsPerEntry` (Map o array indicizzato). Più semplice: estendere
direttamente l'oggetto entry passato al client con due nuovi campi:

```ts
interface CampaignEntryEnriched extends CampaignEntry {
  callCount: number  // chiamate nell'intervallo della voce
  target: number     // ceil(count * 0.15)
}
```

Il client riceve l'array già arricchito e lo renderizza senza calcoli
extra.

Il calcolo lato server:

```ts
const entriesForOp = (campaignEntries || [])
  .filter(e => e.user_id === opId)
  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

const enriched: CampaignEntryEnriched[] = entriesForOp.map((entry, i) => {
  const nextEntry = entriesForOp[i + 1]
  const intervalEnd = nextEntry
    ? new Date(nextEntry.created_at).toISOString()
    : `${lastOfMonth}T23:59:59.999Z`
  const callCount = (callOutcomes || []).filter(c =>
    c.user_id === opId
    && c.created_at >= entry.created_at
    && c.created_at < intervalEnd
  ).length
  return {
    ...entry,
    callCount,
    target: Math.ceil(entry.count * 0.15),
  }
})
```

`callOutcomes` è già caricato (con `created_at` selezionato) — basta
aggiungere `created_at` allo `select` se non c'è già.

### UI

In `KpiPageClient.tsx`, modificare il blocco "Expanded entries" per
ogni riga:

```
+961  18 mag        [██████████████░░░░]  142 / 145  98%   ×
+500  15 mag        [████░░░░░░░░░░░░░░]   34 / 75   45%   ×
```

Layout per riga (espanso):
- Sinistra: `+count · note? · data` (com'è oggi)
- Centro: mini progress bar `~120px` con colore verde/ambra/rosso
- Destra: testo compatto `X / target` + percentuale + pulsante elimina

Colori soglia (stesse del popup operatore):
- verde se `pct < 50`
- ambra se `50 <= pct < 80`
- rosso se `pct >= 80`

Mini progress bar: riuso del componente `ProgressBar` esistente in
`KpiPageClient.tsx` (size='sm') con un override di larghezza.

### Performance

Il calcolo è O(N × M) dove N = voci dell'operatrice e M = call_outcomes
del mese per quella operatrice. Per i numeri tipici (decine di voci,
qualche migliaio di chiamate) è trascurabile e tutto in memoria —
nessuna nuova query DB.

## Scope

**In scope**
- Estensione del calcolo lato `src/app/admin/kpi/page.tsx` con
  `callCount` e `target` su ciascuna voce
- Tipo `CampaignEntryEnriched` (o estensione esistente in-file)
- UI: mini barra + conteggio nell'espansione

**Fuori scope**
- Nuove colonne nella tabella principale (il totale `Chiamate (15%)`
  per operatrice già c'è)
- Filtri/ordinamento delle voci
- Esportazione (CSV)
- Vista lato operatrice (separata)

## Rischi

- **Voce con next-entry in un mese diverso**: l'intervallo viene
  troncato al fine-mese del mese selezionato. L'utente vede "calls
  fatte di questo mese su questa lista" → semantica corretta per la
  pagina KPI mensile.
- **call_outcomes non ha indice su `(user_id, created_at)` filtrato in
  finestra**: già selezioniamo tutte le chiamate del mese, quindi il
  filtraggio in-memory è veloce. Nessun cambio di schema.

## File coinvolti

- `src/app/admin/kpi/page.tsx` (calcolo)
- `src/app/admin/kpi/KpiPageClient.tsx` (UI)
- Possibile aggiunta di tipo locale (no cambio in `src/lib/types.ts`)
