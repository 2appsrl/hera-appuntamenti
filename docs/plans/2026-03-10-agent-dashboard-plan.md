# Agent Dashboard, Outcomes & Export - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix admin appointments display bug, add agent role with dedicated dashboard (weekly calendar + appointment outcomes), and enable export from both admin and agent views.

**Architecture:** Extend existing Next.js + Supabase app with new `agente` role, `/agente` route with weekly list view, `appointment_outcomes` table for tracking results, and CSV/print export. Agent accounts are created by superadmin and linked to `agents` table via `user_id`.

**Tech Stack:** Next.js 16, React 19, Supabase (PostgreSQL + Auth), Tailwind CSS v4, Recharts

---

### Task 1: Fix admin appointments display bug

The admin dashboard at `/admin` shows count badge "1" for appointments but the table may render empty. The Supabase query `appointments.select('*, agents(name, type), users(name)')` joins on `users(name)` which requires PostgREST to discover the FK. Since `appointments.user_id` references `users.id` (a custom table, not `auth.users`), the relationship should work — but if `users` data is null for any reason, the row still renders. Investigate by checking actual data returned.

**Files:**
- Modify: `src/app/admin/page.tsx:60-75` (appointments query)
- Modify: `src/app/admin/AdminDashboard.tsx:186-203` (table rendering)

**Step 1: Investigate the appointments data**

Add error logging to the admin page query to see what's actually returned. Check if `users(name)` join returns null. The issue might be that the query returns data but the `users` join fails silently.

In `src/app/admin/page.tsx`, temporarily log the appointments result:
```typescript
const { data: appointments, error: apptError } = await appointmentsQuery
console.log('APPOINTMENTS DEBUG:', JSON.stringify(appointments), apptError)
```

Check the server logs. If `users` is null on the appointment object, the FK relationship isn't working. Fix by using explicit foreign key hint:
```typescript
.select('*, agents(name, type), users!appointments_user_id_fkey(name)')
```

Or if that doesn't work, fetch users separately and merge.

**Step 2: Fix the query or rendering**

Based on findings, either:
- A) Fix the FK hint in the select query
- B) If the join works but dates are filtering it out, fix the date filter
- C) If the appointment exists but has no matching date in the default "today" filter, ensure the filter defaults are correct

Remove the debug log after fixing.

**Step 3: Verify and commit**

Run: `npm run build` — expect clean build
Deploy: `npx netlify deploy --prod`
Commit: `git commit -m "fix: admin appointments table display"`

---

### Task 2: Database schema changes (Supabase SQL)

**Files:**
- Modify: `supabase/schema.sql` (update with new schema)

**Step 1: Run SQL in Supabase SQL Editor**

Navigate to Supabase SQL Editor (https://supabase.com/dashboard/project/ihttvrfhbcznynqhobrm/sql/new) and run:

```sql
-- 1. Add 'agente' to users role check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('operatore', 'superadmin', 'agente'));

-- 2. Add user_id to agents table (links agent record to auth login)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 3. Create appointment_outcomes table
CREATE TABLE IF NOT EXISTS appointment_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE UNIQUE,
  outcome TEXT NOT NULL CHECK (outcome IN ('positivo', 'negativo', 'non_presentato')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS for appointment_outcomes
ALTER TABLE appointment_outcomes ENABLE ROW LEVEL SECURITY;

-- Superadmin can do everything
CREATE POLICY "Superadmin can read all outcomes" ON appointment_outcomes FOR SELECT USING (is_superadmin());
CREATE POLICY "Superadmin can insert outcomes" ON appointment_outcomes FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY "Superadmin can update outcomes" ON appointment_outcomes FOR UPDATE USING (is_superadmin());

-- Agents can read and manage outcomes for appointments assigned to them
CREATE POLICY "Agents can read own outcomes" ON appointment_outcomes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN agents ag ON a.agent_id = ag.id
    WHERE a.id = appointment_outcomes.appointment_id
    AND ag.user_id = auth.uid()
  )
);

CREATE POLICY "Agents can insert own outcomes" ON appointment_outcomes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN agents ag ON a.agent_id = ag.id
    WHERE a.id = appointment_id
    AND ag.user_id = auth.uid()
  )
);

CREATE POLICY "Agents can update own outcomes" ON appointment_outcomes FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM appointments a
    JOIN agents ag ON a.agent_id = ag.id
    WHERE a.id = appointment_outcomes.appointment_id
    AND ag.user_id = auth.uid()
  )
);

-- Agents can read their own appointments
CREATE POLICY "Agents can read own appointments" ON appointments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agents ag
    WHERE ag.id = appointments.agent_id
    AND ag.user_id = auth.uid()
  )
);

-- Agents can read agents table (for their own record)
-- (Already has "Everyone can read agents" policy)
```

**Step 2: Update schema.sql file**

Update `supabase/schema.sql` to reflect the new schema including:
- `users.role` CHECK with 'agente'
- `agents.user_id` column
- `appointment_outcomes` table
- New RLS policies

**Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add agente role, appointment_outcomes table, agent RLS policies"
```

---

### Task 3: Update TypeScript types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add new types**

```typescript
// Update UserRole
export type UserRole = 'operatore' | 'superadmin' | 'agente'

// Update Agent interface - add user_id
export interface Agent {
  id: string
  name: string
  type: AgentType
  active: boolean
  address: string | null
  user_id: string | null
  created_at: string
}

// Add AppointmentOutcomeType
export type AppointmentOutcomeType = 'positivo' | 'negativo' | 'non_presentato'

// Add AppointmentOutcome interface
export interface AppointmentOutcome {
  id: string
  appointment_id: string
  outcome: AppointmentOutcomeType
  notes: string | null
  created_at: string
}

// Add AppointmentWithOutcome for agent dashboard
export interface AppointmentForAgent extends Appointment {
  appointment_outcomes: AppointmentOutcome | null
}
```

**Step 2: Build to verify types**

Run: `npm run build`
Expected: clean build (no other files reference the new types yet)

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add agente types - AppointmentOutcome, AppointmentForAgent"
```

---

### Task 4: Update middleware and root redirect for agente role

**Files:**
- Modify: `src/middleware.ts:44` (add agente redirect)
- Modify: `src/app/page.tsx:16` (add agente redirect)

**Step 1: Update middleware.ts**

Change the login redirect logic (line 44) from:
```typescript
url.pathname = profile?.role === 'superadmin' ? '/admin' : '/operatore'
```
to:
```typescript
url.pathname = profile?.role === 'superadmin' ? '/admin' : profile?.role === 'agente' ? '/agente' : '/operatore'
```

**Step 2: Update root page.tsx**

Change line 16 from:
```typescript
redirect(profile?.role === 'superadmin' ? '/admin' : '/operatore')
```
to:
```typescript
const dest = profile?.role === 'superadmin' ? '/admin' : profile?.role === 'agente' ? '/agente' : '/operatore'
redirect(dest)
```

**Step 3: Build and commit**

Run: `npm run build`
```bash
git add src/middleware.ts src/app/page.tsx
git commit -m "feat: add agente role routing in middleware and root redirect"
```

---

### Task 5: Add createAgentUser server action

**Files:**
- Modify: `src/app/admin/gestione/actions.ts` (add createAgentUser action)

**Step 1: Add the server action**

Add to `actions.ts` after the existing agent CRUD section:

```typescript
export async function createAgentUser(agentId: string, data: { email: string; password: string; name: string }) {
  const adminClient = createAdminClient()

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })

  if (authError) throw new Error(authError.message)

  // Create profile with role 'agente'
  const supabase = await createClient()
  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    email: data.email,
    name: data.name,
    role: 'agente',
  })

  if (profileError) {
    // Rollback: delete auth user if profile creation fails
    await adminClient.auth.admin.deleteUser(authData.user.id)
    throw new Error(profileError.message)
  }

  // Link agent to user
  const { error: linkError } = await supabase.from('agents').update({ user_id: authData.user.id }).eq('id', agentId)

  if (linkError) {
    await adminClient.auth.admin.deleteUser(authData.user.id)
    throw new Error(linkError.message)
  }

  revalidatePath('/admin/gestione')
}
```

**Step 2: Build and commit**

Run: `npm run build`
```bash
git add src/app/admin/gestione/actions.ts
git commit -m "feat: add createAgentUser server action for agent login creation"
```

---

### Task 6: Update AgentManager UI - add login creation

**Files:**
- Modify: `src/app/admin/gestione/AgentManager.tsx`

**Step 1: Add agent user creation UI**

Import the new action:
```typescript
import { createAgent, updateAgent, deleteAgent, setAgentAvailability, createAgentUser } from './actions'
```

Add state for credential form:
```typescript
const [credentialsForId, setCredentialsForId] = useState<string | null>(null)
const [agentEmail, setAgentEmail] = useState('')
const [agentPassword, setAgentPassword] = useState('')
const [agentLoginName, setAgentLoginName] = useState('')
```

Add handler:
```typescript
async function handleCreateAgentUser(agentId: string) {
  if (!agentEmail || !agentPassword || !agentLoginName) return
  setError('')
  try {
    await createAgentUser(agentId, { email: agentEmail, password: agentPassword, name: agentLoginName })
    setCredentialsForId(null)
    setAgentEmail('')
    setAgentPassword('')
    setAgentLoginName('')
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Errore')
  }
}
```

In the agent list, add a "Crea accesso" button for agents without `user_id`:
```tsx
{!agent.user_id && (
  <button onClick={() => { setCredentialsForId(agent.id); setAgentLoginName(agent.name) }}
    className="text-xs font-medium text-emerald-600 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
    Crea accesso
  </button>
)}
{agent.user_id && (
  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Ha accesso</span>
)}
```

Add credentials form below the agent row when `credentialsForId === agent.id`:
```tsx
{credentialsForId === agent.id && (
  <div className="mt-3 bg-emerald-50 p-3 rounded-xl space-y-2 border border-emerald-100">
    <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Crea credenziali accesso</div>
    <div className="grid grid-cols-3 gap-2">
      <input value={agentLoginName} onChange={e => setAgentLoginName(e.target.value)}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" placeholder="Nome" />
      <input type="email" value={agentEmail} onChange={e => setAgentEmail(e.target.value)}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" placeholder="Email" />
      <input type="text" value={agentPassword} onChange={e => setAgentPassword(e.target.value)}
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" placeholder="Password" />
    </div>
    <div className="flex gap-2">
      <button onClick={() => handleCreateAgentUser(agent.id)}
        className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer">Crea</button>
      <button onClick={() => setCredentialsForId(null)}
        className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 cursor-pointer">Annulla</button>
    </div>
  </div>
)}
```

**Step 2: Build and commit**

Run: `npm run build`
```bash
git add src/app/admin/gestione/AgentManager.tsx
git commit -m "feat: add agent login creation UI in gestione"
```

---

### Task 7: Create agent dashboard page (`/agente`)

**Files:**
- Create: `src/app/agente/page.tsx` (server component)
- Create: `src/app/agente/AgentDashboardClient.tsx` (client component)
- Create: `src/app/agente/actions.ts` (server actions)

**Step 1: Create server actions for agent**

Create `src/app/agente/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { AppointmentOutcomeType } from '@/lib/types'

export async function setAppointmentOutcome(appointmentId: string, outcome: AppointmentOutcomeType, notes?: string) {
  const supabase = await createClient()

  // Upsert: insert or update if already exists
  const { error } = await supabase
    .from('appointment_outcomes')
    .upsert({
      appointment_id: appointmentId,
      outcome,
      notes: notes || null,
    }, { onConflict: 'appointment_id' })

  if (error) throw new Error(error.message)
  revalidatePath('/agente')
}
```

**Step 2: Create the server page**

Create `src/app/agente/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import AgentDashboardClient from './AgentDashboardClient'
import type { AppointmentForAgent } from '@/lib/types'

export default async function AgentePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
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

  if (!profile || profile.role !== 'agente') redirect('/admin')

  // Find the agent record linked to this user
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, type')
    .eq('user_id', user.id)
    .single()

  if (!agent) redirect('/login')

  // Calculate week range
  const today = new Date()
  const weekOffset = parseInt(params.week || '0')
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const mondayStr = monday.toISOString().split('T')[0]
  const sundayStr = sunday.toISOString().split('T')[0]

  // Fetch appointments for this agent this week
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, appointment_outcomes(*)')
    .eq('agent_id', agent.id)
    .gte('appointment_date', mondayStr)
    .lte('appointment_date', sundayStr)
    .order('appointment_date')
    .order('appointment_time')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={agent.name} role={profile.role} />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <AgentDashboardClient
          agentName={agent.name}
          agentType={agent.type}
          appointments={(appointments as AppointmentForAgent[]) || []}
          weekOffset={weekOffset}
          mondayStr={mondayStr}
          sundayStr={sundayStr}
        />
      </main>
    </div>
  )
}
```

**Step 3: Create the client component**

Create `src/app/agente/AgentDashboardClient.tsx` — a weekly list view with:
- Week navigation (prev/next arrows with current week label)
- Appointments grouped by day
- Each appointment card with: time, client name+surname, phone, location, notes
- Outcome buttons (Positivo/Negativo/Non presentato) with optional notes
- Badge showing existing outcome
- Export CSV button + Print button

The component should:
- Use `useRouter` for week navigation via `?week=N` param
- Call `setAppointmentOutcome` action when outcome is clicked
- Have `exportCSV()` function similar to admin's
- Have print button that calls `window.print()`

**Step 4: Build, verify and commit**

Run: `npm run build`
```bash
git add src/app/agente/
git commit -m "feat: add agent dashboard with weekly view and appointment outcomes"
```

---

### Task 8: Update admin dashboard to show outcomes

**Files:**
- Modify: `src/app/admin/page.tsx` (include outcomes in query)
- Modify: `src/app/admin/AdminDashboard.tsx` (show outcome badge in table)

**Step 1: Update appointments query**

In `src/app/admin/page.tsx`, change the select from:
```typescript
.select('*, agents(name, type), users(name)')
```
to:
```typescript
.select('*, agents(name, type), users(name), appointment_outcomes(*)')
```

**Step 2: Update AdminDashboard to show outcome badges**

In the AppointmentRow interface, add:
```typescript
appointment_outcomes: { outcome: string; notes: string | null } | null
```

In the table, add an "Esito" column and show a colored badge:
- positivo: green
- negativo: red
- non_presentato: gray
- null: dash

Also update the CSV export to include the outcome column.

**Step 3: Build, deploy and commit**

Run: `npm run build && npx netlify deploy --prod`
```bash
git add src/app/admin/page.tsx src/app/admin/AdminDashboard.tsx
git commit -m "feat: show appointment outcomes in admin dashboard"
```

---

### Task 9: Final deploy and verification

**Step 1: Full build**

Run: `npm run build`

**Step 2: Deploy to Netlify**

Run: `npx netlify deploy --prod`

**Step 3: Verify on production**

- Test admin login -> `/admin` dashboard shows appointments correctly
- Test agent filter works on admin dashboard
- Test CSV export includes all data
- Create a test agent user from gestione
- Login as agent -> `/agente` shows weekly view
- Navigate weeks, test outcome buttons
- Test agent CSV export and print

**Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete agent dashboard with outcomes, export, and admin improvements"
```
