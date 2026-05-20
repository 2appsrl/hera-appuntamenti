# KPI — Conteggio chiamate per voce — Piano di implementazione

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mostrare nella pagina `/admin/kpi`, sotto la lista espansa delle voci di una operatrice, il conteggio delle chiamate fatte su ogni singola lista con mini barra di avanzamento al 15%.

**Architecture:** Calcolo tutto lato server in `src/app/admin/kpi/page.tsx` arricchendo ogni voce con `callCount` (chiamate nell'intervallo `[entry.created_at, next.created_at)` tronc​ato al fine-mese) e `target` (`ceil(entry.count * 0.15)`). Il client estende il blocco espandibile esistente con una mini barra colorata. Nessun cambio di schema DB, nessuna nuova query.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, React 19.

**Verifica:** progetto senza test runner. Per ogni task:
- `npx tsc --noEmit` clean (ignora errori in `.next/types/...`)
- `npx eslint --no-warn-ignored <files>` clean
- Smoke test manuale via preview (login superadmin → /admin/kpi → espandi una voce)

Design di riferimento: `docs/plans/2026-05-18-kpi-call-counts-per-voce-design.md`.

---

## Task 1: Calcolo `callCount` e `target` per voce in `page.tsx`

**Files:**
- Modify: `src/app/admin/kpi/page.tsx`

### Step 1 — Leggere il file

Capire la struttura attuale. Trovare:
- la query `callOutcomes` (intorno alla riga ~68 — verifica che selezioni `created_at` e `user_id`)
- la query `campaignEntries` (`select('*')` — già seleziona created_at e count)
- il blocco `operatorStats.map(...)` (dove viene costruito `entries` per ogni operatrice, intorno alla riga ~119)

### Step 2 — Aggiungere il tipo locale `CampaignEntryEnriched`

In testa al file (dopo `interface CampaignEntry` se esiste, oppure subito dopo gli import), aggiungere:

```ts
interface CampaignEntryEnriched extends CampaignEntry {
  callCount: number
  target: number
}
```

Se l'`interface CampaignEntry` non esiste localmente, è importata da `./page` o simile — la usi per estendere. Se nel codice oggi c'è solo un'inferenza Supabase per le righe `campaign_entries`, allora definisci `CampaignEntryEnriched` come tipo completo standalone (campi: `id`, `user_id`, `month`, `count`, `created_at`, `note`, `callCount`, `target`).

### Step 3 — Aggiornare la query `callOutcomes`

Assicurati che la `select` includa `created_at` e `user_id`. La query attuale è:

```ts
let callQuery = admin
  .from('call_outcomes')
  .select('user_id')
  .gte('created_at', `${firstOfMonth}T00:00:00`)
  .lte('created_at', `${lastOfMonth}T23:59:59`)
```

Sostituire `select('user_id')` con `select('user_id, created_at')`.

### Step 4 — Arricchire le voci dentro `operatorStats.map(...)`

Trova questo blocco:

```ts
const entries = ((campaignEntries || []) as CampaignEntry[])
  .filter(e => e.user_id === opId)
  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
```

Sostituiscilo con:

```ts
const operatorEntries = ((campaignEntries || []) as CampaignEntry[])
  .filter(e => e.user_id === opId)
  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

const opCallOutcomes = (callOutcomes || []).filter((c: { user_id: string; created_at: string }) => c.user_id === opId)
const endOfMonthIso = `${lastOfMonth}T23:59:59.999`

const entries: CampaignEntryEnriched[] = operatorEntries.map((entry, i) => {
  const nextEntry = operatorEntries[i + 1]
  const intervalStart = entry.created_at
  const intervalEndIso = nextEntry
    ? nextEntry.created_at
    : endOfMonthIso
  const callCount = opCallOutcomes.filter(c =>
    c.created_at >= intervalStart && c.created_at < intervalEndIso
  ).length
  return {
    ...entry,
    callCount,
    target: Math.ceil(entry.count * 0.15),
  }
})
```

NB: `lastOfMonth` è già calcolato all'inizio del file. Verifica che il tipo passato all'`OperatorKpi.entries` (in `KpiPageClient.tsx` o file types) sia compatibile con il nuovo `CampaignEntryEnriched`. Se è tipato come `CampaignEntry[]`, allargalo a `CampaignEntryEnriched[]`.

### Step 5 — Verificare

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npx tsc --noEmit 2>&1 | grep -v "\.next/types/" | grep -v "^$" | head -10
```

Expected: nessun errore. Se il client `KpiPageClient.tsx` ha un tipo strettamente `CampaignEntry[]` per la prop `entries`, può servire aggiornare la firma — gestito nel Task 2.

```bash
npx eslint --no-warn-ignored src/app/admin/kpi/page.tsx 2>&1 | tail -5
```

Expected: clean.

### Step 6 — Commit

```bash
git add src/app/admin/kpi/page.tsx
git commit -m "feat(kpi): compute per-entry callCount and target server-side"
```

---

## Task 2: Mini barra + conteggio nella vista espansa di `KpiPageClient.tsx`

**Files:**
- Modify: `src/app/admin/kpi/KpiPageClient.tsx`

### Step 1 — Leggere il file

Trovare il blocco "Expanded entries" intorno alla riga ~269-292 dove `op.entries.map((entry: CampaignEntry) => (...))` renderizza ogni voce.

### Step 2 — Aggiornare il tipo locale

Se nel file esiste un'interfaccia `CampaignEntry`, estenderla per includere `callCount: number; target: number` come optional (per non rompere chiamate esterne) oppure required. Visto che il server adesso passa sempre questi campi, fai required:

```ts
interface CampaignEntry {
  id: string
  user_id: string
  month: string
  count: number
  note: string | null
  created_at: string
  callCount: number
  target: number
}
```

(adattare alle convenzioni esistenti — se i campi esistono già, aggiungerli)

### Step 3 — Estendere la riga della voce espansa

Sostituire la riga attuale della voce:

```tsx
<div key={entry.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 text-xs">
  <div>
    <span className="font-semibold text-gray-700">+{entry.count}</span>
    {entry.note && <span className="text-gray-400 ml-1.5">— {entry.note}</span>}
    <span className="text-gray-300 ml-1.5">
      {new Date(entry.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
    </span>
  </div>
  <button
    onClick={() => handleDeleteEntry(entry.id)}
    className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer p-0.5"
    title="Elimina"
  >
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>
```

con questo, che aggiunge una mini barra e il conteggio prima del bottone elimina:

```tsx
<div key={entry.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 text-xs">
  <div className="flex-shrink-0 min-w-[88px]">
    <span className="font-semibold text-gray-700">+{entry.count}</span>
    {entry.note && <span className="text-gray-400 ml-1.5">— {entry.note}</span>}
    <span className="text-gray-300 ml-1.5">
      {new Date(entry.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
    </span>
  </div>
  <div className="flex-1 flex items-center gap-2 min-w-[120px]">
    <ProgressBar value={entry.callCount} max={entry.target} size="sm" />
    <span className="font-semibold text-gray-700 whitespace-nowrap tabular-nums">
      {entry.callCount} / {entry.target}
    </span>
    <PctBadge value={entry.callCount} max={entry.target} />
  </div>
  <button
    onClick={() => handleDeleteEntry(entry.id)}
    className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer p-0.5 flex-shrink-0"
    title="Elimina"
  >
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>
```

I componenti `ProgressBar` e `PctBadge` sono già definiti in cima al file `KpiPageClient.tsx`. Usali come sono.

### Step 4 — Verificare layout

`min-w-[88px]` sulla parte sinistra mantiene allineata l'apertura della barra anche con note variabili. Se le voci stanno strette, regola il `min-w` ma non rompere la disposizione orizzontale.

### Step 5 — Verificare compilazione

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npx tsc --noEmit 2>&1 | grep -v "\.next/types/" | grep -v "^$" | head -10
```

Expected: clean.

```bash
npx eslint --no-warn-ignored src/app/admin/kpi/KpiPageClient.tsx 2>&1 | tail -5
```

Expected: clean.

### Step 6 — Smoke test (preview)

Avvia `mcp__Claude_Preview__preview_start` con `next-dev`, login come superadmin → `/admin/kpi` → espandi una voce di Beatrice → verifica che si veda la mini barra + `X / Y` + percentuale.

### Step 7 — Commit

```bash
git add src/app/admin/kpi/KpiPageClient.tsx
git commit -m "feat(kpi): show per-voce call progress in expanded entries"
```

---

## Task 3: Build + deploy

### Step 1 — Build

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npm run build 2>&1 | tail -20
```

Expected: build successful.

### Step 2 — Push GitHub (Netlify auto-deploy)

```bash
git push origin main 2>&1 | tail -5
```

Expected: push successful. Netlify rileva il push e parte l'auto-deploy.

NB: in questa sessione il push funziona perché il PAT è stato configurato nel keychain.

### Step 3 — Verifica deploy

Aspetta ~1 minuto, poi controlla https://app.netlify.com/projects/hera-appuntamenti/deploys per confermare che il build di Netlify sia "Published". Oppure controlla direttamente la pagina su https://hera-appuntamenti.netlify.app/admin/kpi.

NB: NON usare `netlify-cli deploy --prod --dir=.next` da local. Il deploy auto via push è la strada canonica per evitare divergenze come quella di stamattina.

### Step 4 — Smoke test produzione

Chiedere all'utente di:
1. Andare su `/admin/kpi`
2. Espandere una voce di un'operatrice con chiamate
3. Verificare la mini barra + `X / Y` + percentuale

---

## Checklist finale

- [ ] Task 1: calcolo server-side
- [ ] Task 2: UI client
- [ ] Task 3: push (Netlify auto-deploy)
