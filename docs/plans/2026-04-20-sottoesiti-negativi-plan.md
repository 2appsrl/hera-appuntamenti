# Sottoesiti e note per l'esito "Negativo" — Piano di implementazione

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggiungere motivo + note all'esito "Negativo" (sia lato operatrice con modal, sia lato admin con sezione "Dettaglio negativi" nella Dashboard).

**Architecture:** Due colonne nullable su `call_outcomes` (`negative_reason`, `negative_notes`). Modal React sul bottone NEGATIVO che raccoglie i dati prima di chiamare la server action esistente `recordOutcome` (estesa). Nuova sezione dashboard che legge le stesse colonne e mostra breakdown + elenco note.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres), Tailwind CSS, Recharts (già presente, non usato qui).

**Verifica:** Questo progetto non ha una suite di test automatizzati. La verifica di ogni task avviene via:
- `npm run lint` (nessun errore nuovo)
- `npm run build` (compila)
- Query SQL via MCP Supabase per verificare lo schema / i dati
- Preview manuale (`mcp__Claude_Preview__preview_start`) per verificare l'UI

Design di riferimento: `docs/plans/2026-04-20-sottoesiti-negativi-design.md`.

Riferimento skills: @superpowers:verification-before-completion per la verifica prima di marcare completo ogni task.

---

## Task 1: Applicare la migration allo schema

**Files:**
- Modify: `supabase/schema.sql` (aggiornamento in loco per documentazione, lo schema è una reference — le modifiche DB vanno sul DB live via MCP `apply_migration`)

**Step 1: Apply migration su Supabase (project id `ihttvrfhbcznynqhobrm`)**

Usa `mcp__42edcf0e-514f-4173-b1a8-a59c2bb92d01__apply_migration` con name `add_negative_reason_and_notes` e questa query:

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

**Step 2: Verificare**

Usa `mcp__42edcf0e-514f-4173-b1a8-a59c2bb92d01__execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='call_outcomes'
  AND column_name IN ('negative_reason','negative_notes');
```

Expected: 2 righe, entrambe `is_nullable='YES'`. Poi:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename='call_outcomes' AND indexname='idx_call_outcomes_negative_reason';
```

Expected: 1 riga.

**Step 3: Aggiornare `supabase/schema.sql`**

Nel file, alla definizione della tabella `call_outcomes` (riga ~36), aggiungere i due campi e dopo la tabella (riga ~41) aggiungere l'index parziale. Solo documentativo — lo schema reale è già stato modificato.

**Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): add negative_reason and negative_notes to call_outcomes"
```

---

## Task 2: Aggiornare tipi TypeScript

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Aggiungere tipi e label map**

In cima al file (dopo `OutcomeType`):

```ts
export type NegativeReason =
  | 'gia_esitato'
  | 'referente_diverso'
  | 'anagrafica_doppia'
  | 'gia_cliente'
  | 'recapito_inesistente'
  | 'altro'

export const NEGATIVE_REASON_LABELS: Record<NegativeReason, string> = {
  gia_esitato: 'Già esitato nella lista precedente',
  referente_diverso: 'Referente diverso dall\'intestatario',
  anagrafica_doppia: 'Anagrafica doppia',
  gia_cliente: 'Già cliente',
  recapito_inesistente: 'Recapito telefonico inesistente',
  altro: 'Altro',
}

export const NEGATIVE_REASON_ORDER: NegativeReason[] = [
  'gia_esitato',
  'referente_diverso',
  'anagrafica_doppia',
  'gia_cliente',
  'recapito_inesistente',
  'altro',
]
```

Poi estendere `CallOutcome`:

```ts
export interface CallOutcome {
  id: string
  user_id: string
  outcome: OutcomeType
  negative_reason: NegativeReason | null
  negative_notes: string | null
  created_at: string
}
```

**Step 2: Verificare compilazione**

```bash
cd "Hera Appuntamenti" && npx tsc --noEmit
```

Expected: nessun errore (o solo errori pre-esistenti, niente di nuovo).

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add NegativeReason type and labels"
```

---

## Task 3: Estendere la server action `recordOutcome`

**Files:**
- Modify: `src/app/operatore/actions.ts` (funzione `recordOutcome`, righe ~8-22)

**Step 1: Nuova signature**

Sostituire l'attuale funzione `recordOutcome` con:

```ts
export async function recordOutcome(
  outcome: OutcomeType,
  details?: { negativeReason?: NegativeReason; negativeNotes?: string },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  // Validazione coerenza
  if (outcome === 'negativo') {
    if (!details?.negativeReason) {
      throw new Error('Motivo obbligatorio per esito negativo')
    }
  } else if (details?.negativeReason || details?.negativeNotes) {
    throw new Error('negative_reason/notes validi solo per outcome=negativo')
  }

  const trimmedNotes = details?.negativeNotes?.trim()
  const notesValue = trimmedNotes && trimmedNotes.length > 0
    ? trimmedNotes.slice(0, 500)
    : null

  const admin = createAdminClient()
  const { error } = await admin
    .from('call_outcomes')
    .insert({
      user_id: user.id,
      outcome,
      negative_reason: outcome === 'negativo' ? details!.negativeReason : null,
      negative_notes: outcome === 'negativo' ? notesValue : null,
    })

  if (error) throw new Error('Errore nel salvataggio')
  return { success: true }
}
```

Aggiungere `NegativeReason` all'import esistente dei tipi:

```ts
import type { OutcomeType, NegativeReason } from '@/lib/types'
```

**Step 2: Verificare compilazione**

```bash
npx tsc --noEmit
```

Expected: potrebbero esserci errori in `OutcomeButtons.tsx` (chiama `recordOutcome` con la vecchia signature) — se sì verranno risolti nel Task 5.

Verifica che `src/app/operatore/actions.ts` da solo compili:

```bash
npx tsc --noEmit --incremental false 2>&1 | grep "operatore/actions" || echo "no errors in actions.ts"
```

**Step 3: Commit**

```bash
git add src/app/operatore/actions.ts
git commit -m "feat(api): extend recordOutcome with negative_reason and notes"
```

---

## Task 4: Creare il componente `NegativeOutcomeModal`

**Files:**
- Create: `src/components/NegativeOutcomeModal.tsx`

**Step 1: Scrivere il componente**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { NEGATIVE_REASON_ORDER, NEGATIVE_REASON_LABELS } from '@/lib/types'
import type { NegativeReason } from '@/lib/types'

const MAX_NOTES = 500

export default function NegativeOutcomeModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: (reason: NegativeReason, notes: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState<NegativeReason | null>(null)
  const [notes, setNotes] = useState('')

  // Reset state on open
  useEffect(() => {
    if (open) {
      setReason(null)
      setNotes('')
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const canConfirm = reason !== null
  const notesLeft = MAX_NOTES - notes.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Esito negativo</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Chiudi"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo</label>
          <div className="space-y-2">
            {NEGATIVE_REASON_ORDER.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  reason === r
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-red-500"
                />
                <span className="text-sm text-gray-800">{NEGATIVE_REASON_LABELS[r]}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Note negativo <span className="text-gray-400 font-normal">(opzionale)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent resize-none"
            placeholder="Dettagli aggiuntivi..."
          />
          <div className="text-xs text-gray-400 text-right mt-1">{notesLeft} caratteri rimasti</div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            Annulla
          </button>
          <button
            onClick={() => reason && onConfirm(reason, notes)}
            disabled={!canConfirm}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verificare compilazione**

```bash
npx tsc --noEmit
```

Expected: nessun errore nel nuovo file.

**Step 3: Commit**

```bash
git add src/components/NegativeOutcomeModal.tsx
git commit -m "feat(ui): add NegativeOutcomeModal component"
```

---

## Task 5: Integrare il modal in `OutcomeButtons`

**Files:**
- Modify: `src/components/OutcomeButtons.tsx`

**Step 1: Aggiungere stato e apertura modal**

Importare in cima al file:

```tsx
import NegativeOutcomeModal from '@/components/NegativeOutcomeModal'
import type { NegativeReason } from '@/lib/types'
```

Aggiungere uno state per il modal:

```tsx
const [negativeModalOpen, setNegativeModalOpen] = useState(false)
```

Sostituire la funzione `handleOutcome` con:

```tsx
function handleOutcome(outcome: OutcomeType) {
  if (outcome === 'appuntamento') {
    onAppointmentClick()
    return
  }
  if (outcome === 'negativo') {
    setNegativeModalOpen(true)
    return
  }

  // non_risponde: fire-and-forget come prima
  onOptimisticUpdate?.(outcome)
  if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
  setFeedback('Non risponde ✓')
  feedbackTimer.current = setTimeout(() => setFeedback(null), 800)
  recordOutcome(outcome).catch(() => {
    setFeedback('Errore nel salvataggio')
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2000)
  })
}

function handleNegativeConfirm(reason: NegativeReason, notes: string) {
  setNegativeModalOpen(false)
  onOptimisticUpdate?.('negativo')
  if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
  setFeedback('Negativo ✓')
  feedbackTimer.current = setTimeout(() => setFeedback(null), 800)
  recordOutcome('negativo', { negativeReason: reason, negativeNotes: notes }).catch(() => {
    setFeedback('Errore nel salvataggio')
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2000)
  })
}
```

Dentro il JSX del componente, subito prima del `</div>` di chiusura più esterno, aggiungere:

```tsx
<NegativeOutcomeModal
  open={negativeModalOpen}
  onConfirm={handleNegativeConfirm}
  onCancel={() => setNegativeModalOpen(false)}
/>
```

**Step 2: Verificare compilazione + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: nessun errore.

**Step 3: Smoke test preview**

```bash
# Avvia dev server via MCP preview_start
```

Usa `mcp__Claude_Preview__preview_start` con `next-dev`. Poi `mcp__Claude_Preview__preview_logs` con `level=error` per verificare che non ci siano errori di runtime.

Verifica manuale in browser (chiedi all'utente):
1. Login come operatrice
2. Click NEGATIVO → si apre modal
3. Conferma disabilitato finché non scegli un motivo
4. Scegli un motivo → abilitato
5. Scrivi note opzionali
6. Conferma → modal si chiude, contatore NEGATIVI +1, toast "Negativo ✓"
7. Query DB: `SELECT * FROM call_outcomes ORDER BY created_at DESC LIMIT 1;` → l'ultima riga deve avere `outcome='negativo'`, il `negative_reason` scelto, e le `negative_notes` giuste (o NULL se vuote)

**Step 4: Commit**

```bash
git add src/components/OutcomeButtons.tsx
git commit -m "feat(operator): wire negative outcome modal into OutcomeButtons"
```

---

## Task 6: Estendere la query admin per includere `negative_reason` e `negative_notes`

**Files:**
- Modify: `src/app/admin/page.tsx` (riga ~56 query outcomes, ~119 operatorSummaries)
- Modify: `src/lib/types.ts` (estensione `OperatorSummary` con contatori sottoesito)

**Step 1: Aggiornare la query outcomes**

La query attuale già fa `select('*')` quindi preleva tutte le colonne. Nessun cambiamento SQL necessario.

Dopo il calcolo di `counts`, aggiungere il breakdown dei motivi:

```ts
// Breakdown negativi per motivo (null = N.D.)
const negativeBreakdown: Record<string, number> = {}
outcomes?.forEach(o => {
  if (o.outcome !== 'negativo') return
  const key = o.negative_reason ?? 'nd'
  negativeBreakdown[key] = (negativeBreakdown[key] || 0) + 1
})

// Ultime note negativi (con texto non vuoto), ordinate desc
const negativeNotesList = (outcomes || [])
  .filter(o => o.outcome === 'negativo' && o.negative_notes && o.negative_notes.trim().length > 0)
  .sort((a, b) => b.created_at.localeCompare(a.created_at))
  .map(o => {
    const op = operators?.find(u => u.id === o.user_id)
    return {
      id: o.id,
      created_at: o.created_at,
      operator_name: op?.name || 'Sconosciuto',
      reason: o.negative_reason as string | null,
      notes: o.negative_notes as string,
    }
  })
```

**Step 2: Passare i nuovi dati ad `AdminDashboard`**

Modificare la chiamata al componente:

```tsx
<AdminDashboard
  dailyData={dailyData}
  operatorSummaries={operatorSummaries}
  counts={counts}
  negativeBreakdown={negativeBreakdown}
  negativeNotes={negativeNotesList}
/>
```

**Step 3: Aggiornare tipi**

In `src/lib/types.ts` aggiungere:

```ts
export interface NegativeBreakdown {
  [key: string]: number  // chiave = NegativeReason | 'nd'
}

export interface NegativeNoteEntry {
  id: string
  created_at: string
  operator_name: string
  reason: string | null
  notes: string
}
```

**Step 4: Verificare**

```bash
npx tsc --noEmit
```

Expected: errori temporanei in `AdminDashboard.tsx` (props non dichiarate) — risolti nel Task 7.

**Step 5: Commit**

```bash
git add src/app/admin/page.tsx src/lib/types.ts
git commit -m "feat(admin): compute negative breakdown and notes list for dashboard"
```

---

## Task 7: Creare la sezione "Dettaglio negativi" in `AdminDashboard`

**Files:**
- Modify: `src/app/admin/AdminDashboard.tsx`

**Step 1: Aggiornare props e importare tipi**

In cima al file:

```tsx
import { NEGATIVE_REASON_LABELS, NEGATIVE_REASON_ORDER } from '@/lib/types'
import type { OutcomeSummary, DailyOutcomeSummary, OperatorSummary, NegativeBreakdown, NegativeNoteEntry } from '@/lib/types'
import { useState } from 'react'
```

Aggiungi `'use client'` in cima al file se non c'è già (c'è).

Estendere la firma:

```tsx
export default function AdminDashboard({
  dailyData,
  operatorSummaries,
  counts,
  negativeBreakdown,
  negativeNotes,
}: {
  dailyData: DailyOutcomeSummary[]
  operatorSummaries: OperatorSummary[]
  counts: OutcomeSummary
  negativeBreakdown: NegativeBreakdown
  negativeNotes: NegativeNoteEntry[]
}) {
```

**Step 2: Calcolare righe ordinate + stato espansione**

Subito prima del `return`:

```tsx
const totalNegativi = counts.negativo
const breakdownRows = [
  ...NEGATIVE_REASON_ORDER.map(r => ({
    key: r,
    label: NEGATIVE_REASON_LABELS[r],
    count: negativeBreakdown[r] || 0,
  })),
  ...(negativeBreakdown.nd > 0
    ? [{ key: 'nd', label: 'N.D. (storici)', count: negativeBreakdown.nd }]
    : []),
]
  .filter(r => r.count > 0)
  .sort((a, b) => b.count - a.count)

const maxBreakdown = breakdownRows[0]?.count || 1
const [showAllNotes, setShowAllNotes] = useState(false)
const visibleNotes = showAllNotes ? negativeNotes : negativeNotes.slice(0, 10)
```

**Step 3: Inserire la sezione nel JSX**

Subito dopo il blocco del `LineChart` (il primo `</div>` che chiude `Andamento giornaliero`), aggiungere:

```tsx
{totalNegativi > 0 && (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Dettaglio negativi</h3>
      <span className="text-xs text-gray-400">
        {totalNegativi} totali
        {negativeBreakdown.nd > 0 && ` · ${negativeBreakdown.nd} N.D.`}
      </span>
    </div>

    {/* Breakdown */}
    <div className="space-y-2">
      {breakdownRows.map(row => {
        const pct = totalNegativi > 0 ? Math.round((row.count / totalNegativi) * 100) : 0
        const widthPct = (row.count / maxBreakdown) * 100
        return (
          <div key={row.key} className="flex items-center gap-3">
            <span className="w-48 text-sm text-gray-700 truncate" title={row.label}>{row.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500"
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className="w-16 text-right text-sm font-semibold text-gray-900">{row.count}</span>
            <span className="w-12 text-right text-xs text-gray-400">{pct}%</span>
          </div>
        )
      })}
    </div>

    {/* Ultime note */}
    {negativeNotes.length > 0 && (
      <div className="pt-4 border-t border-gray-100">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Note ({negativeNotes.length})</h4>
        <div className="space-y-2">
          {visibleNotes.map(n => (
            <div key={n.id} className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                <span>{new Date(n.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
                <span>·</span>
                <span className="font-medium text-gray-700">{n.operator_name}</span>
                {n.reason && (
                  <>
                    <span>·</span>
                    <span className="italic">{NEGATIVE_REASON_LABELS[n.reason as keyof typeof NEGATIVE_REASON_LABELS] || n.reason}</span>
                  </>
                )}
              </div>
              <p className="text-gray-800 whitespace-pre-wrap break-words">{n.notes}</p>
            </div>
          ))}
        </div>
        {negativeNotes.length > 10 && (
          <button
            onClick={() => setShowAllNotes(v => !v)}
            className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            {showAllNotes ? 'Mostra meno' : `Mostra tutte (${negativeNotes.length})`}
          </button>
        )}
      </div>
    )}
  </div>
)}
```

**Step 4: Verificare**

```bash
npx tsc --noEmit && npm run lint
```

Expected: nessun errore.

Avviare preview e verificare via snapshot/screenshot che la sezione compaia sotto "Andamento giornaliero" quando ci sono negativi.

**Step 5: Commit**

```bash
git add src/app/admin/AdminDashboard.tsx
git commit -m "feat(admin): add Dettaglio negativi section to dashboard"
```

---

## Task 8: Build + deploy in produzione

**Step 1: Build locale**

```bash
cd "Hera Appuntamenti" && npm run build
```

Expected: build completa senza errori.

**Step 2: Deploy su Netlify**

```bash
npx --yes netlify-cli deploy --build --prod
```

Expected: "Production deploy is live" su `https://hera-appuntamenti.netlify.app`.

**Step 3: Smoke test in produzione**

Chiedere all'utente di:
1. Loggarsi come operatrice → cliccare NEGATIVO → compilare modal → confermare.
2. Loggarsi come superadmin → aprire Dashboard → verificare comparsa sezione "Dettaglio negativi" con il nuovo esito tra le barre.
3. Se c'erano note → verificare siano elencate sotto.

**Step 4: Push su GitHub (se il PAT è stato risolto)**

```bash
git push origin main
```

Se il PAT non è ancora risolto, skippare questo step. I commit restano locali ma il deploy è già in produzione.

---

## Checklist finale

- [ ] Task 1: Migration applicata + verificata
- [ ] Task 2: Tipi TS aggiunti
- [ ] Task 3: `recordOutcome` esteso
- [ ] Task 4: `NegativeOutcomeModal` creato
- [ ] Task 5: Modal integrato in `OutcomeButtons`
- [ ] Task 6: Query admin estesa
- [ ] Task 7: Sezione "Dettaglio negativi" in Dashboard
- [ ] Task 8: Deploy + smoke test
