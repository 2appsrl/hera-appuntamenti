# KPI Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an admin KPI dashboard page showing Hera campaign progress — nominativi, chiamate (15% target), and contratti (3.5% of call target) — with per-operator breakdown and inline nominativi management.

**Architecture:** Server component fetches campaign_entries, call_outcomes, and appointment_outcomes for the selected month. Client component renders filters, summary cards with progress bars, and operator breakdown table with inline add-nominativi form.

**Tech Stack:** Next.js 16 (App Router), Supabase (admin client), Tailwind CSS, Recharts (optional for gauges)

---

### Task 1: Database — Add campaign_entries table to schema

**Files:**
- Modify: `supabase/schema.sql` (append after line 158)

**Step 1: Add table + RLS to schema.sql**

Append to end of `supabase/schema.sql`:

```sql
-- Campaign nominativi entries (KPI tracking)
CREATE TABLE campaign_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  month text NOT NULL, -- "2026-04" format
  count integer NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_campaign_entries_user_month ON campaign_entries(user_id, month);

ALTER TABLE campaign_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin can manage campaign entries" ON campaign_entries FOR ALL USING (is_superadmin());
```

**Step 2: Print SQL for Supabase migration**

Output the SQL above so user can run it in Supabase SQL Editor.

**Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): add campaign_entries table for KPI tracking"
```

---

### Task 2: Server Actions — CRUD for campaign entries

**Files:**
- Create: `src/app/admin/kpi/actions.ts`

**Step 1: Create server actions file**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addCampaignEntry(data: {
  userId: string
  month: string
  count: number
  note?: string
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('campaign_entries').insert({
    user_id: data.userId,
    month: data.month,
    count: data.count,
    note: data.note || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/kpi')
}

export async function deleteCampaignEntry(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('campaign_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/kpi')
}
```

**Step 2: Commit**

```bash
git add src/app/admin/kpi/actions.ts
git commit -m "feat(kpi): add server actions for campaign entries CRUD"
```

---

### Task 3: Server Component — KPI page data fetching

**Files:**
- Create: `src/app/admin/kpi/page.tsx`

**Step 1: Create the server component**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/Header'
import KpiPageClient from './KpiPageClient'

export const dynamic = 'force-dynamic'

export default async function KpiPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; operator?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'superadmin') {
    redirect(profile?.role === 'agente' ? '/agente' : profile?.role === 'operatore' ? '/operatore' : '/login')
  }

  const today = new Date().toISOString().split('T')[0]
  const currentMonth = today.slice(0, 7) // "2026-04"
  const selectedMonth = params.month || currentMonth
  const firstOfMonth = `${selectedMonth}-01`
  // Last day of month
  const [y, m] = selectedMonth.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const lastOfMonth = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`

  const admin = createAdminClient()

  // Build call_outcomes query
  let callQuery = admin
    .from('call_outcomes')
    .select('user_id')
    .gte('created_at', `${firstOfMonth}T00:00:00`)
    .lte('created_at', `${lastOfMonth}T23:59:59`)

  // Build appointment_outcomes query (positivo only)
  // Join through appointments to get user_id and filter by date
  let apptQuery = admin
    .from('appointments')
    .select('user_id, appointment_outcomes!inner(outcome)')
    .gte('appointment_date', firstOfMonth)
    .lte('appointment_date', lastOfMonth)

  if (params.operator) {
    callQuery = callQuery.eq('user_id', params.operator)
    apptQuery = apptQuery.eq('user_id', params.operator)
  }

  const [
    { data: operators },
    { data: campaignEntries },
    { data: callOutcomes },
    { data: appointmentData },
  ] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'operatore').order('name'),
    admin.from('campaign_entries').select('*').eq('month', selectedMonth),
    callQuery,
    apptQuery,
  ])

  // Aggregate per operator
  const operatorIds = params.operator
    ? [params.operator]
    : (operators || []).map(o => o.id)

  const operatorStats = operatorIds.map(opId => {
    const op = (operators || []).find(o => o.id === opId)
    const nominativi = (campaignEntries || [])
      .filter(e => e.user_id === opId)
      .reduce((sum, e) => sum + e.count, 0)
    const targetChiamate = Math.ceil(nominativi * 0.15)
    const targetContratti = Math.ceil(targetChiamate * 0.035)
    const chiamateFatte = (callOutcomes || []).filter(c => c.user_id === opId).length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contrattiChiusi = (appointmentData || []).filter((a: any) => {
      if (a.user_id !== opId) return false
      const outcome = Array.isArray(a.appointment_outcomes)
        ? a.appointment_outcomes[0]
        : a.appointment_outcomes
      return outcome?.outcome === 'positivo'
    }).length

    const entries = (campaignEntries || [])
      .filter(e => e.user_id === opId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    return {
      operatorId: opId,
      operatorName: op?.name || 'Sconosciuto',
      nominativi,
      targetChiamate,
      targetContratti,
      chiamateFatte,
      contrattiChiusi,
      entries,
    }
  })

  // Totals
  const totals = {
    nominativi: operatorStats.reduce((s, o) => s + o.nominativi, 0),
    targetChiamate: operatorStats.reduce((s, o) => s + o.targetChiamate, 0),
    targetContratti: operatorStats.reduce((s, o) => s + o.targetContratti, 0),
    chiamateFatte: operatorStats.reduce((s, o) => s + o.chiamateFatte, 0),
    contrattiChiusi: operatorStats.reduce((s, o) => s + o.contrattiChiusi, 0),
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <KpiPageClient
          operators={operators || []}
          operatorStats={operatorStats}
          totals={totals}
          selectedMonth={selectedMonth}
          selectedOperator={params.operator || ''}
        />
      </main>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/admin/kpi/page.tsx
git commit -m "feat(kpi): add server component with data fetching"
```

---

### Task 4: Client Component — KPI dashboard UI

**Files:**
- Create: `src/app/admin/kpi/KpiPageClient.tsx`

**Step 1: Create the client component**

This is the largest file. It includes:
- Month/operator filter dropdowns
- 3 summary cards with progress bars (nominativi, chiamate, contratti)
- Operator breakdown table with inline progress
- Inline "add nominativi" form per operator
- Progress bar color logic: red < 50%, yellow 50-80%, green >= 80%

The component receives `operators`, `operatorStats`, `totals`, `selectedMonth`, `selectedOperator` as props.

Key UI elements:
- `ProgressBar` helper component with color thresholds
- Month dropdown generates last 12 months
- "Aggiungi nominativi" expands inline form per operator row
- Entries history expandable per operator

Full implementation with Tailwind styling matching existing admin pages (rounded-2xl cards, shadow-sm, border-gray-100 pattern).

**Step 2: Commit**

```bash
git add src/app/admin/kpi/KpiPageClient.tsx
git commit -m "feat(kpi): add client component with dashboard UI"
```

---

### Task 5: Navigation — Add KPI link to Header

**Files:**
- Modify: `src/components/Header.tsx` (line 37, after Fasce Orarie link)

**Step 1: Add KPI link**

After the "Fasce Orarie" link (line 37), add:
```tsx
<a href="/admin/kpi" className="text-sm font-medium text-amber-600 hover:text-amber-800 transition-colors">KPI</a>
```

**Step 2: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat(nav): add KPI link to admin header"
```

---

### Task 6: Build & Deploy

**Step 1: Run build**

```bash
npm run build
```

Fix any TypeScript errors.

**Step 2: Push to GitHub**

```bash
git push
```

Netlify auto-deploys from main.

**Step 3: Run SQL migration on Supabase**

User runs the campaign_entries CREATE TABLE SQL in Supabase SQL Editor.

**Step 4: Verify on production**

Navigate to `/admin/kpi` and verify:
- Filters work (month, operator)
- Can add nominativi per operator
- Progress bars calculate correctly
- Colors change based on thresholds
