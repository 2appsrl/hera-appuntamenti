# Popup 15% per-lista — Piano di implementazione

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Spostare il trigger del popup "smettere di esitare su Salesforce" dal vecchio campo fisso `users.monthly_call_limit` al 15% della lista attiva (ultimo `campaign_entries` per operatrice), con counter che riparte da 0 a ogni nuova lista. Aggiungere una card di avanzamento sulla pagina operatrice. `monthly_call_limit` resta come override manuale.

**Architecture:** Tutto resta lato Next.js senza nuove dipendenze né nuove tabelle. La pagina operatrice (server component) calcola lista attiva + conteggio chiamate dopo il `created_at` di quella entry e passa il payload come prop al client. Le server action `recordOutcome` e `createAppointment` chiamano `revalidatePath('/operatore')` così la pagina si aggiorna dopo ogni click.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres, TypeScript, Tailwind, React 19.

**Verifica:** progetto senza test runner. Per ogni task:
- `npx tsc --noEmit` clean
- `npx eslint --no-warn-ignored <files>` clean
- Smoke test manuale per la UI/popup

Design di riferimento: `docs/plans/2026-05-18-popup-15-percent-per-lista-design.md`.

---

## Task 1: Tipo `CurrentListaInfo`

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Aggiungere il tipo**

In fondo al file `src/lib/types.ts`:

```ts
export type CurrentListaInfo =
  | { source: 'override'; target: number; count: number }
  | {
      source: 'lista'
      target: number
      count: number
      listaCount: number       // nominativi della lista
      listaCreatedAt: string   // ISO date
    }
  | { source: 'none' }
```

**Step 2: Verificare**

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npx tsc --noEmit
```

Expected: clean.

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add CurrentListaInfo discriminated union"
```

---

## Task 2: Revalidate /operatore dopo ogni esito

**Files:**
- Modify: `src/app/operatore/actions.ts`

**Step 1: Aggiungere `revalidatePath('/operatore')` a `recordOutcome` e `createAppointment`**

In `recordOutcome` (oggi non revalida): subito prima di `return { success: true }`, aggiungere:

```ts
revalidatePath('/operatore')
```

In `createAppointment`: già revalida `/operatore`, **nessuna modifica necessaria**. Verificare leggendo il file.

**Step 2: Verificare**

```bash
npx tsc --noEmit
npx eslint --no-warn-ignored src/app/operatore/actions.ts
```

Expected: clean.

**Step 3: Commit**

```bash
git add src/app/operatore/actions.ts
git commit -m "feat(operator): revalidate /operatore after recording outcome"
```

---

## Task 3: Calcolare lista corrente in `page.tsx`

**Files:**
- Modify: `src/app/operatore/page.tsx`

**Step 1: Leggere il file**

Capire la struttura. Cerca dove oggi viene calcolato `monthlyCallCount` e dove vengono fatte le query. Servono due nuove query (o una sostituzione) PRIMA del return JSX:

1. La più recente `campaign_entries` riga per l'utente loggato.
2. Conteggio `call_outcomes` dopo il `created_at` di quella entry.

**Step 2: Aggiungere il calcolo `listaInfo`**

Inserire questo blocco dopo il caricamento di `profile` (e dopo che `user`, `supabase`, `monthlyCallCount` sono già disponibili):

```ts
import type { CurrentListaInfo } from '@/lib/types'

// ...

// Calcolo lista corrente / override
let listaInfo: CurrentListaInfo

if (profile.monthly_call_limit !== null) {
  listaInfo = {
    source: 'override',
    target: profile.monthly_call_limit,
    count: monthlyCallCount,
  }
} else {
  const { data: latestEntry } = await supabase
    .from('campaign_entries')
    .select('count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestEntry) {
    listaInfo = { source: 'none' }
  } else {
    const { count: listCallCount } = await supabase
      .from('call_outcomes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('created_at', latestEntry.created_at)

    listaInfo = {
      source: 'lista',
      target: Math.ceil(latestEntry.count * 0.15),
      count: listCallCount ?? 0,
      listaCount: latestEntry.count,
      listaCreatedAt: latestEntry.created_at,
    }
  }
}
```

**Step 3: Passare `listaInfo` a `OperatorPageClient`**

Aggiungere al JSX `<OperatorPageClient ... listaInfo={listaInfo} />`.

Verificare che la prop `monthlyCallCount` esistente venga ancora passata (non rimuovere per ora — viene rimossa dopo che il client viene aggiornato in Task 4).

**Step 4: Verificare**

```bash
npx tsc --noEmit
```

Expected: errore in `OperatorPageClient` perché manca la prop nuova — verrà risolto nel Task 4. Verifica solo che `page.tsx` non abbia errori suoi.

```bash
npx tsc --noEmit 2>&1 | grep "page.tsx" | head -5
```

Expected: no output (solo errori in OperatorPageClient).

**Step 5: Commit**

```bash
git add src/app/operatore/page.tsx
git commit -m "feat(operator): compute current lista info server-side"
```

---

## Task 4: UI lato client — card "Lista corrente" + nuovo trigger popup

**Files:**
- Modify: `src/app/operatore/OperatorPageClient.tsx`

**Step 1: Aggiornare props**

Importare il tipo:

```tsx
import type {
  Agent, AgentAvailability, AppointmentWithAgent,
  AppointmentWithAgentAndOutcome, OutcomeSummary, CurrentListaInfo,
} from '@/lib/types'
```

Estendere la firma del componente. Aggiungere `listaInfo: CurrentListaInfo` e **rimuovere** `monthlyCallCount` e `monthlyCallLimit` (ora derivati da `listaInfo`):

```tsx
export default function OperatorPageClient({
  agents,
  availability,
  todayAppointments,
  allAppointments,
  initialCounts,
  activeSessionStartedAt,
  todayMinutesWorked,
  listaInfo,
}: {
  agents: Pick<Agent, 'id' | 'name' | 'type' | 'address'>[]
  availability: AgentAvailability[]
  todayAppointments: AppointmentWithAgent[]
  allAppointments: AppointmentWithAgentAndOutcome[]
  initialCounts: OutcomeSummary
  activeSessionStartedAt: string | null
  todayMinutesWorked: number
  listaInfo: CurrentListaInfo
}) {
```

Aggiornare anche la chiamata in `src/app/operatore/page.tsx` per rimuovere `monthlyCallCount` e `monthlyCallLimit` dai props passati.

**Step 2: Sostituire la logica di stato del popup**

Rimuovere:

```tsx
const [monthlyCount, setMonthlyCount] = useState(monthlyCallCount)
const [showLimitAlert, setShowLimitAlert] = useState(
  !!(monthlyCallLimit && monthlyCallCount >= monthlyCallLimit)
)
```

Aggiungere:

```tsx
// Stato locale: target/count derivati da listaInfo + optimistic +1 per click
const initialTarget = listaInfo.source === 'none' ? null : listaInfo.target
const initialCount = listaInfo.source === 'none' ? 0 : listaInfo.count

const [listaCount, setListaCount] = useState(initialCount)
const [showLimitAlert, setShowLimitAlert] = useState(
  initialTarget !== null && initialCount >= initialTarget
)

// Sync quando il server revalida (es. nuova lista caricata)
useEffect(() => {
  setListaCount(initialCount)
  // Se cambia il target perché è arrivata una nuova lista, e ora siamo
  // sotto la soglia, nascondi il popup automaticamente.
  if (initialTarget === null || initialCount < initialTarget) {
    setShowLimitAlert(false)
  } else {
    setShowLimitAlert(true)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [listaInfo])
```

**Step 3: Aggiornare `handleOptimisticOutcome`**

Sostituire la parte sul `monthlyCount`:

```tsx
function handleOptimisticOutcome(outcome: keyof OutcomeSummary) {
  setCounts(prev => ({ ...prev, [outcome]: prev[outcome] + 1 }))
  if (initialTarget !== null) {
    setListaCount(prev => {
      const newCount = prev + 1
      if (newCount >= initialTarget) setShowLimitAlert(true)
      return newCount
    })
  }
}
```

**Step 4: Aggiornare il contenuto del popup**

Nel modale, sostituire la sezione che usa `monthlyCallLimit` e `monthlyCount`:

```tsx
{initialTarget !== null && (
  <div className="bg-red-50 rounded-2xl px-6 py-3 inline-block">
    <span className="text-red-600 font-bold text-xl">{listaCount}</span>
    <span className="text-red-400 text-sm font-medium"> / {initialTarget} esiti su Salesforce</span>
  </div>
)}
```

**Step 5: Aggiungere la card "Lista corrente"**

Subito sopra al `<DailyCounter counts={counts} />`, aggiungere:

```tsx
{listaInfo.source !== 'none' && (() => {
  const target = listaInfo.target
  const pct = target > 0 ? Math.min(100, Math.round((listaCount / target) * 100)) : 0
  const remaining = Math.max(0, target - listaCount)
  const barColor =
    pct >= 80 ? 'from-red-400 to-red-500'
    : pct >= 50 ? 'from-amber-400 to-amber-500'
    : 'from-emerald-400 to-emerald-500'
  const bgColor =
    pct >= 80 ? 'bg-red-100'
    : pct >= 50 ? 'bg-amber-100'
    : 'bg-emerald-100'
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lista corrente</span>
        <span className="text-xs font-medium text-gray-400">{pct}%</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900 tabular-nums">{listaCount}</span>
        <span className="text-sm text-gray-400">/ {target} esiti su Salesforce</span>
        <span className="ml-auto text-sm font-medium text-gray-600">{remaining} da fare</span>
      </div>
      <div className={`w-full ${bgColor} rounded-full h-3 overflow-hidden`}>
        <div
          className={`h-3 rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-gray-400">
        {listaInfo.source === 'lista' ? (
          <>
            Nominativi caricati: <span className="font-semibold text-gray-600">{listaInfo.listaCount}</span>
            <span> · Caricato il </span>
            <span>{new Date(listaInfo.listaCreatedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
          </>
        ) : (
          <>Limite manuale</>
        )}
      </div>
    </div>
  )
})()}
```

**Step 6: Verificare**

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npx tsc --noEmit
npx eslint --no-warn-ignored src/app/operatore/page.tsx src/app/operatore/OperatorPageClient.tsx 2>&1 | tail -5
```

Expected: entrambi clean.

**Step 7: Smoke test (con preview server)**

`mcp__Claude_Preview__preview_start` con `next-dev`, login come operatrice. Verifica:
- Se l'operatrice ha entries → card "Lista corrente" appare, mostra `X / Y esiti su Salesforce`.
- Click su un esito → contatore aumenta di 1 ottimisticamente, dopo qualche millisecondo la pagina revalida e i numeri si confermano.
- Quando `listaCount >= target` → popup appare.
- Test manuale: come superadmin aggiungi un nuovo `campaign_entry` per quell'operatrice → torna sulla pagina operatrice e clicca un esito → popup sparisce (nuova lista) e barra mostra `1 / nuovo_target`.

**Step 8: Commit**

```bash
git add src/app/operatore/OperatorPageClient.tsx src/app/operatore/page.tsx
git commit -m "feat(operator): lista corrente card + per-lista popup trigger"
```

---

## Task 5: Build + deploy

**Step 1: Build locale**

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npm run build 2>&1 | tail -20
```

Expected: build pulita, `/operatore` rimane nella lista delle route.

**Step 2: Deploy Netlify**

```bash
npx --yes netlify-cli deploy --prod --dir=.next 2>&1 | tail -15
```

Expected: "Production deploy is live".

**Step 3: Smoke test produzione**

Chiedere all'utente di:
1. Loggarsi come operatrice con almeno una `campaign_entry` esistente.
2. Verificare card "Lista corrente" visibile con `X / Y esiti`.
3. Fare qualche click esito — la barra avanza.
4. Da admin (KPI page), aggiungere una nuova lista per quell'operatrice.
5. Tornare alla pagina operatrice (anche solo lasciando la tab attiva e cliccando un esito) → barra ripartita da 0 sul nuovo target.

**Step 4: Push (se PAT funzionante)**

```bash
git push origin main
```

---

## Checklist finale

- [ ] Task 1: tipo `CurrentListaInfo`
- [ ] Task 2: revalidate /operatore in recordOutcome
- [ ] Task 3: query server-side lista corrente
- [ ] Task 4: card UI + nuovo trigger popup
- [ ] Task 5: build + deploy + smoke
