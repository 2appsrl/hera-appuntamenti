# Sottoesiti e note per l'esito "Negativo" — Design

Data: 2026-04-20

## Obiettivo

Quando l'operatrice segna una chiamata come "Negativo", raccogliere anche
il motivo (tra 6 valori fissi) e note libere opzionali. L'admin deve
vedere il breakdown dei motivi e le note nella Dashboard.

## Requisiti utente

- L'operatrice clicca NEGATIVO → si apre un modal con:
  - Selezione obbligatoria di un motivo tra:
    - Già esitato nella lista precedente come negativo
    - Referente diverso dall'intestatario
    - Anagrafica doppia
    - Già cliente
    - Recapito telefonico inesistente
    - Altro
  - Campo "Note negativo" (testo libero, sempre opzionale)
- L'admin vede nella Dashboard una sezione "Dettaglio negativi" con:
  - Breakdown per motivo (conteggio + percentuale)
  - Elenco delle ultime note
- I 245 negativi storici senza motivo rimangono come sono e appaiono
  nel breakdown come "N.D."

## Decisioni architetturali

### Schema

Due colonne nullable aggiunte direttamente a `call_outcomes`:

```sql
ALTER TABLE call_outcomes
  ADD COLUMN negative_reason TEXT
    CHECK (negative_reason IN (
      'gia_esitato',
      'referente_diverso',
      'anagrafica_doppia',
      'gia_cliente',
      'recapito_inesistente',
      'altro'
    )),
  ADD COLUMN negative_notes TEXT;

CREATE INDEX idx_call_outcomes_negative_reason
  ON call_outcomes(negative_reason)
  WHERE outcome = 'negativo';
```

**Motivazione:** 2 campi legati 1-a-1 al caso "negativo". Una tabella
separata `negative_outcome_details` aggiungerebbe un JOIN a ogni query
della dashboard senza benefici concreti. Segue lo stesso pattern del
resto dello schema (es. `appointments` contiene campi validi solo quando
`call_outcomes.outcome = 'appuntamento'`).

L'index parziale tiene leggere le query di breakdown sulla dashboard.

### Flusso operatore

Bottone NEGATIVO → apre modal (non salva subito).

- Radio group per il motivo, bottone "Conferma" disabilitato finché non
  è selezionato nulla.
- Textarea opzionale per le note (max 500 caratteri, hint sotto il
  campo).
- Escape/click fuori/Annulla → chiude senza salvare.
- Conferma → chiusura modal + aggiornamento ottimistico del contatore
  NEGATIVI + toast "Negativo ✓". In background: chiamata server.
- Errore rete → toast rosso, contatore torna indietro.

"Non risponde" resta fire-and-forget (nessuna modifica).
"Appuntamento" resta il form esistente (nessuna modifica).

### Server action

Estensione della `recordOutcome` esistente:

```ts
recordOutcome({
  outcome: OutcomeType,
  negativeReason?: NegativeReason,
  negativeNotes?: string,
})
```

Validazioni server-side:
- Se `outcome !== 'negativo'` e i campi `negative*` sono presenti → errore
  (coerenza dati).
- Se `outcome === 'negativo'` e `negativeReason` mancante → errore.
- Trim delle note, max 500 caratteri, empty string → null in DB.

### Dashboard admin

Nuova sezione "Dettaglio negativi" tra il grafico "Andamento giornaliero"
e la tabella "Riepilogo per operatrice". Rispetta i filtri attivi
(data/operatrice/agente) della dashboard.

**Breakdown:**
- Una barra orizzontale per ogni `negative_reason`, ordinato per
  frequenza desc.
- Per ogni barra: label italiana, conteggio assoluto, percentuale sul
  totale negativi del periodo filtrato.
- "N.D." appare solo se ci sono negativi con `negative_reason = NULL`
  nel periodo.
- Uso barre CSS custom (stesso stile delle `ProgressBar` già presenti
  in KPI), nessuna nuova libreria.

**Ultime note:**
- Elenco delle ultime 10 righe con `negative_notes` non vuote nel
  periodo filtrato.
- Ogni riga: data + operatrice + motivo + testo nota.
- Bottone "Mostra tutte" → espande tutte le note del periodo.

**Rendering:**
- Se non ci sono negativi nel periodo, la sezione non viene renderizzata
  (coerente col comportamento degli altri box).

## Scope

**In scope**
- Migration SQL (2 colonne + index parziale)
- Modal operatore con validazione
- `recordOutcome` esteso + tipi TypeScript
- Sezione "Dettaglio negativi" in `/admin`
- Pulizia orfani già fatta in sessione precedente (non rilevante qui)

**Fuori scope (da richiedere se servono)**
- Filtro della dashboard per sottoesito (click-to-filter)
- Sottoesiti per "Non risponde" o "Appuntamento"
- Editing di un negativo già salvato
- Export CSV aggiornato
- Visualizzazione sottoesiti nella pagina KPI campagna
- Alert/notifiche su pattern

## Rischi

- Il modal rallenta il flusso rispetto al click singolo attuale.
  Mitigazione futura (solo se serve): scorciatoie da tastiera 1-6 per
  selezionare i motivi rapidamente.
- I 245 negativi storici restano "N.D." per sempre. Se in futuro si
  vuole ripulire, basta una migrazione `UPDATE … SET negative_reason =
  'altro' WHERE outcome = 'negativo' AND negative_reason IS NULL`.

## File toccati

- `supabase/schema.sql` — aggiornato (riferimento)
- Nuova migration SQL (applicata via MCP Supabase)
- `src/lib/types.ts` — `NegativeReason`, label map, tipi aggiornati
- `src/app/operatore/actions.ts` — `recordOutcome` esteso
- `src/components/OutcomeButtons.tsx` — modal negativo
- `src/app/admin/page.tsx` — query estesa
- `src/app/admin/AdminDashboard.tsx` — sezione "Dettaglio negativi"
