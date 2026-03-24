# Operator Edit Appointments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Appuntamenti Fissati" section to the operator dashboard with tabs (Prossimi/Passati), filters (agente/data/esito), outcome badges, and edit functionality via the existing AppointmentModal.

**Architecture:** Add a new type `AppointmentWithAgentAndOutcome` that includes the agent's outcome. Fetch all operator appointments server-side. Extend `AppointmentModal` with an `editData` prop for edit mode. New server action `updateAppointment` writes to the same `appointments` table so changes are visible everywhere.

**Tech Stack:** Next.js server actions, Supabase, React (client components), Tailwind CSS

---

### Task 1: Add new type `AppointmentWithAgentAndOutcome`

**Files:**
- Modify: `src/lib/types.ts:53-55`

**Step 1: Add the new type**

Add after the existing `AppointmentWithAgent` interface at line 55:

```typescript
export interface AppointmentWithAgentAndOutcome extends Appointment {
  agents: Pick<Agent, 'name' | 'type'>
  appointment_outcomes: AppointmentOutcome | null
}
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add AppointmentWithAgentAndOutcome type"
```

---

### Task 2: Add `updateAppointment` and `getOperatorAppointments` server actions

**Files:**
- Modify: `src/app/operatore/actions.ts`

**Step 1: Add `getOperatorAppointments` action**

Add at the end of `src/app/operatore/actions.ts`:

```typescript
export async function getOperatorAppointments() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const { data, error } = await supabase
    .from('appointments')
    .select('*, agents(name, type), appointment_outcomes(*)')
    .eq('user_id', user.id)
    .order('appointment_date', { ascending: false })
    .order('appointment_time', { ascending: false })

  if (error) throw new Error('Errore nel caricamento appuntamenti')
  return data || []
}
```

**Step 2: Add `updateAppointment` action**

Add after the previous function:

```typescript
export async function updateAppointment(
  appointmentId: string,
  formData: {
    clientName: string
    clientSurname: string
    clientPhone: string
    agentId: string
    appointmentDate: string
    appointmentTime: string
    location: string
    notes: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const admin = createAdminClient()

  // Verify appointment belongs to this operator
  const { data: existing } = await admin
    .from('appointments')
    .select('id')
    .eq('id', appointmentId)
    .eq('user_id', user.id)
    .single()

  if (!existing) throw new Error('Appuntamento non trovato')

  const { error } = await admin
    .from('appointments')
    .update({
      agent_id: formData.agentId,
      client_name: formData.clientName,
      client_surname: formData.clientSurname,
      client_phone: formData.clientPhone,
      appointment_date: formData.appointmentDate,
      appointment_time: formData.appointmentTime,
      location: formData.location,
      notes: formData.notes || null,
    })
    .eq('id', appointmentId)

  if (error) throw new Error('Errore nell\'aggiornamento')

  revalidatePath('/operatore')
  revalidatePath('/agente')
  revalidatePath('/admin')
  return { success: true }
}
```

**Step 3: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors

**Step 4: Commit**

```bash
git add src/app/operatore/actions.ts
git commit -m "feat: add updateAppointment and getOperatorAppointments server actions"
```

---

### Task 3: Extend `AppointmentModal` with edit mode

**Files:**
- Modify: `src/components/AppointmentModal.tsx`

**Step 1: Update the component props and imports**

Replace the existing props type and component signature. The modal needs:
- A new optional prop `editData` containing the appointment to edit (with its `id`)
- Import `updateAppointment` alongside `createAppointment`
- Title changes to "Modifica Appuntamento" in edit mode
- Form initialised with existing data in edit mode
- Submit calls `updateAppointment` instead of `createAppointment` when editing

Changes to `AppointmentModal.tsx`:

1. Add import at top:
```typescript
import { createAppointment, updateAppointment } from '@/app/operatore/actions'
```

2. Update props interface — add `editData`:
```typescript
export default function AppointmentModal({
  agents,
  availability,
  onClose,
  onCreated,
  editData,
}: {
  agents: Pick<Agent, 'id' | 'name' | 'type' | 'address'>[]
  availability: AgentAvailability[]
  onClose: () => void
  onCreated?: () => void
  editData?: {
    id: string
    clientName: string
    clientSurname: string
    clientPhone: string
    agentId: string
    appointmentDate: string
    appointmentTime: string
    location: string
    notes: string
  }
})
```

3. Update initial form state to use editData when provided:
```typescript
const [form, setForm] = useState({
  clientName: editData?.clientName ?? '',
  clientSurname: editData?.clientSurname ?? '',
  clientPhone: editData?.clientPhone ?? '',
  agentId: editData?.agentId ?? '',
  appointmentDate: editData?.appointmentDate ?? '',
  appointmentTime: editData?.appointmentTime ?? '',
  location: editData?.location ?? '',
  notes: editData?.notes ?? '',
})
```

4. Update `handleSubmit` to branch on edit vs create:
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setError('')

  if (!isDateAvailable(form.appointmentDate)) {
    setError("La data selezionata non e' disponibile per questo agente")
    return
  }

  setSaving(true)
  try {
    if (editData) {
      await updateAppointment(editData.id, form)
    } else {
      await createAppointment(form)
      onCreated?.()
    }
    onClose()
  } catch {
    setError('Errore nel salvataggio')
  } finally {
    setSaving(false)
  }
}
```

5. Update modal title:
```typescript
<h2 className="text-lg font-bold text-gray-800">
  {editData ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
</h2>
```

6. Update submit button text:
```typescript
{saving ? 'Salvataggio...' : editData ? 'AGGIORNA APPUNTAMENTO' : 'SALVA APPUNTAMENTO'}
```

7. In edit mode, remove the `min` date restriction (allow past dates for corrections):
```typescript
min={editData ? undefined : new Date().toISOString().split('T')[0]}
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors

**Step 3: Commit**

```bash
git add src/components/AppointmentModal.tsx
git commit -m "feat: add edit mode to AppointmentModal"
```

---

### Task 4: Fetch all operator appointments in page.tsx

**Files:**
- Modify: `src/app/operatore/page.tsx`

**Step 1: Add query for all appointments with outcomes**

In the `Promise.all` block, add a new query alongside the existing ones. Add a 7th item:

```typescript
supabase
  .from('appointments')
  .select('*, agents(name, type), appointment_outcomes(*)')
  .eq('user_id', user.id)
  .order('appointment_date')
  .order('appointment_time'),
```

Destructure it:
```typescript
const [
  { data: outcomes },
  { data: appointments },
  { data: agents },
  { data: availability },
  { data: activeSession },
  { data: todaySessions },
  { data: allAppointments },
] = await Promise.all([...])
```

**Step 2: Update type import**

Add `AppointmentWithAgentAndOutcome` to the import from `@/lib/types`.

**Step 3: Pass `allAppointments` to OperatorPageClient**

Add to the JSX:
```typescript
<OperatorPageClient
  agents={agents || []}
  availability={availability || []}
  todayAppointments={(appointments as AppointmentWithAgent[]) || []}
  allAppointments={(allAppointments as AppointmentWithAgentAndOutcome[]) || []}
  initialCounts={counts}
  activeSessionStartedAt={activeSession?.started_at || null}
  todayMinutesWorked={...}
/>
```

**Step 4: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors

**Step 5: Commit**

```bash
git add src/app/operatore/page.tsx
git commit -m "feat: fetch all operator appointments with outcomes"
```

---

### Task 5: Build the "Appuntamenti Fissati" section in OperatorPageClient

**Files:**
- Modify: `src/app/operatore/OperatorPageClient.tsx`

This is the largest task. Replace the "Appuntamenti di oggi" section with the new "Appuntamenti Fissati" section featuring tabs, filters, and edit capability.

**Step 1: Update imports and props**

Add `AppointmentWithAgentAndOutcome` to the type import. Add `useRouter` from `next/navigation`. Add `allAppointments` to the props:

```typescript
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DailyCounter from '@/components/DailyCounter'
import OutcomeButtons from '@/components/OutcomeButtons'
import AppointmentModal from '@/components/AppointmentModal'
import { startCallSession, stopCallSession } from './actions'
import type { Agent, AgentAvailability, AppointmentWithAgent, AppointmentWithAgentAndOutcome, OutcomeSummary } from '@/lib/types'
```

Add to component props:
```typescript
allAppointments: AppointmentWithAgentAndOutcome[]
```

**Step 2: Add state for tab, filters, and edit modal**

Inside the component, after existing state declarations:

```typescript
const router = useRouter()
const [activeTab, setActiveTab] = useState<'prossimi' | 'passati'>('prossimi')
const [showFilters, setShowFilters] = useState(false)
const [filterAgent, setFilterAgent] = useState('')
const [filterDateFrom, setFilterDateFrom] = useState('')
const [filterDateTo, setFilterDateTo] = useState('')
const [filterOutcome, setFilterOutcome] = useState('')
const [editingAppointment, setEditingAppointment] = useState<AppointmentWithAgentAndOutcome | null>(null)
```

**Step 3: Add filtered/sorted appointments memo**

```typescript
const today = new Date().toISOString().split('T')[0]

const filteredAppointments = useMemo(() => {
  let list = allAppointments.filter(a =>
    activeTab === 'prossimi' ? a.appointment_date >= today : a.appointment_date < today
  )

  if (filterAgent) {
    list = list.filter(a => a.agent_id === filterAgent)
  }
  if (filterDateFrom) {
    list = list.filter(a => a.appointment_date >= filterDateFrom)
  }
  if (filterDateTo) {
    list = list.filter(a => a.appointment_date <= filterDateTo)
  }
  if (filterOutcome) {
    if (filterOutcome === 'in_attesa') {
      list = list.filter(a => !a.appointment_outcomes)
    } else {
      list = list.filter(a => a.appointment_outcomes?.outcome === filterOutcome)
    }
  }

  // Prossimi: soonest first; Passati: most recent first
  list.sort((a, b) => {
    const dateCompare = a.appointment_date.localeCompare(b.appointment_date)
    if (dateCompare !== 0) return activeTab === 'prossimi' ? dateCompare : -dateCompare
    const timeCompare = a.appointment_time.localeCompare(b.appointment_time)
    return activeTab === 'prossimi' ? timeCompare : -timeCompare
  })

  return list
}, [allAppointments, activeTab, today, filterAgent, filterDateFrom, filterDateTo, filterOutcome])
```

**Step 4: Add outcome badge helper**

```typescript
function outcomeBadge(outcome: AppointmentWithAgentAndOutcome) {
  const o = outcome.appointment_outcomes
  if (!o) return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">In attesa</span>
  const styles = {
    positivo: 'bg-emerald-100 text-emerald-700',
    negativo: 'bg-red-100 text-red-700',
    non_presentato: 'bg-gray-200 text-gray-600',
  }
  const labels = { positivo: 'Positivo', negativo: 'Negativo', non_presentato: 'Non presentato' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[o.outcome]}`}>{labels[o.outcome]}</span>
}
```

**Step 5: Replace the "Appuntamenti di oggi" section**

Replace everything from `<div>` at line 182 to `</div>` at line 220 with the new section:

```tsx
{/* Appuntamenti Fissati */}
<div>
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
      Appuntamenti Fissati
    </h2>
    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
      {allAppointments.length}
    </span>
  </div>

  {/* Tabs */}
  <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
    <button
      onClick={() => setActiveTab('prossimi')}
      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
        activeTab === 'prossimi' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
      }`}
    >
      Prossimi
    </button>
    <button
      onClick={() => setActiveTab('passati')}
      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
        activeTab === 'passati' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
      }`}
    >
      Passati
    </button>
  </div>

  {/* Filters toggle */}
  <button
    onClick={() => setShowFilters(!showFilters)}
    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2 cursor-pointer"
  >
    <svg className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
    Filtri
  </button>

  {/* Filters panel */}
  {showFilters && (
    <div className="bg-white rounded-xl p-3 border border-gray-100 mb-3 space-y-2">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Agente</label>
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Tutti</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Da</label>
          <input
            type="date" value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">A</label>
          <input
            type="date" value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Esito</label>
        <select
          value={filterOutcome}
          onChange={e => setFilterOutcome(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Tutti</option>
          <option value="in_attesa">In attesa</option>
          <option value="positivo">Positivo</option>
          <option value="negativo">Negativo</option>
          <option value="non_presentato">Non presentato</option>
        </select>
      </div>
      {(filterAgent || filterDateFrom || filterDateTo || filterOutcome) && (
        <button
          onClick={() => { setFilterAgent(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterOutcome('') }}
          className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
        >
          Resetta filtri
        </button>
      )}
    </div>
  )}

  {/* Appointment list */}
  {filteredAppointments.length === 0 ? (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
      <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-gray-400 text-sm">Nessun appuntamento</p>
    </div>
  ) : (
    <div className="space-y-2">
      {filteredAppointments.map((apt) => (
        <div key={apt.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="bg-emerald-50 text-emerald-700 font-bold text-xs px-2.5 py-1.5 rounded-lg text-center shrink-0">
                <div>{apt.appointment_time.slice(0, 5)}</div>
                <div className="text-[10px] font-medium text-emerald-500">
                  {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">{apt.client_name} {apt.client_surname}</div>
                <div className="text-xs text-gray-400 truncate">{apt.client_phone}</div>
                {apt.location && (
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{apt.location}</div>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{apt.agents?.name}</span>
                  {outcomeBadge(apt)}
                </div>
              </div>
            </div>
            <button
              onClick={() => setEditingAppointment(apt)}
              className="text-gray-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors shrink-0 cursor-pointer"
              title="Modifica"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

{/* Edit modal */}
{editingAppointment && (
  <AppointmentModal
    agents={agents}
    availability={availability}
    onClose={() => {
      setEditingAppointment(null)
      router.refresh()
    }}
    editData={{
      id: editingAppointment.id,
      clientName: editingAppointment.client_name,
      clientSurname: editingAppointment.client_surname,
      clientPhone: editingAppointment.client_phone,
      agentId: editingAppointment.agent_id,
      appointmentDate: editingAppointment.appointment_date,
      appointmentTime: editingAppointment.appointment_time,
      location: editingAppointment.location,
      notes: editingAppointment.notes || '',
    }}
  />
)}
```

**Step 6: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: no new errors

**Step 7: Commit**

```bash
git add src/app/operatore/OperatorPageClient.tsx
git commit -m "feat: add Appuntamenti Fissati section with tabs, filters, edit"
```

---

### Task 6: Manual verification

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test as operator**

1. Login as an operator
2. Verify "Appuntamenti Fissati" section appears
3. Switch between "Prossimi" and "Passati" tabs
4. Open filters and filter by agent, date range, esito
5. Click "Resetta filtri" to clear
6. Click edit (pencil icon) on an appointment
7. Verify modal opens pre-filled with data
8. Change a field (e.g. location) and save
9. Verify the change reflects immediately

**Step 3: Test cross-dashboard sync**

1. After editing an appointment as operator, open agent dashboard
2. Verify the change is visible in the agent's weekly view
3. Open admin dashboard → Appuntamenti tab
4. Verify the change is visible there too

**Step 4: Commit final (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues from manual testing"
```
