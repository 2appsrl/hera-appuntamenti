# Hera Appuntamenti - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a call-tracking web app for Heracomm operators to log call outcomes and appointments, with admin dashboard for reporting.

**Architecture:** Next.js App Router with Supabase for auth + PostgreSQL database. Server components for data fetching, client components for interactive UI (buttons, forms, charts). API routes for mutations. Supabase RLS for row-level security.

**Tech Stack:** Next.js 14 (App Router), Supabase (Auth + PostgreSQL), Tailwind CSS, Recharts, TypeScript

**Design doc:** `docs/plans/2026-03-09-hera-appuntamenti-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `.env.local.example`, `src/app/layout.tsx`, `src/app/page.tsx`

**Step 1: Initialize Next.js project**

Run from the project root `/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti`:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. This creates the full Next.js scaffold with Tailwind.

**Step 2: Install Supabase + Recharts dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr recharts date-fns
```

**Step 3: Create `.env.local.example`**

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Step 4: Create Supabase client utilities**

Create `src/lib/supabase/client.ts` (browser client):

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create `src/lib/supabase/server.ts` (server client):

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component - ignore
          }
        },
      },
    }
  )
}
```

Create `src/lib/supabase/admin.ts` (service role client for creating users):

```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

**Step 5: Create Supabase middleware for auth**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in -> redirect to login (except /login itself)
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged in -> redirect from login to appropriate page
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    // Fetch user role from profiles table
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const url = request.nextUrl.clone()
    url.pathname = profile?.role === 'superadmin' ? '/admin' : '/operatore'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

**Step 6: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js project with Supabase client setup"
```

---

## Task 2: Supabase Database Setup

**Files:**
- Create: `supabase/schema.sql` (reference SQL, applied via Supabase dashboard)

**Step 1: Write the complete SQL schema**

Create `supabase/schema.sql`:

```sql
-- Users profile table (linked to auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('operatore', 'superadmin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents and sportelli
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('agente', 'sportello')),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly availability for agents
CREATE TABLE agent_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (end_time > start_time)
);

-- Call outcomes (every button click)
CREATE TABLE call_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('non_risponde', 'negativo', 'appuntamento')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments (only for outcome = 'appuntamento')
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_outcome_id UUID NOT NULL REFERENCES call_outcomes(id),
  user_id UUID NOT NULL REFERENCES users(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  client_name TEXT NOT NULL,
  client_surname TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  location TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_call_outcomes_user_date ON call_outcomes(user_id, created_at);
CREATE INDEX idx_call_outcomes_created_at ON call_outcomes(created_at);
CREATE INDEX idx_appointments_user_date ON appointments(user_id, appointment_date);
CREATE INDEX idx_appointments_agent_date ON appointments(agent_id, appointment_date);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Users policies
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Superadmin can read all users" ON users FOR SELECT USING (is_superadmin());
CREATE POLICY "Superadmin can insert users" ON users FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY "Superadmin can update users" ON users FOR UPDATE USING (is_superadmin());
CREATE POLICY "Superadmin can delete users" ON users FOR DELETE USING (is_superadmin());

-- Agents policies (everyone can read active agents, superadmin can manage)
CREATE POLICY "Everyone can read agents" ON agents FOR SELECT USING (TRUE);
CREATE POLICY "Superadmin can insert agents" ON agents FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY "Superadmin can update agents" ON agents FOR UPDATE USING (is_superadmin());
CREATE POLICY "Superadmin can delete agents" ON agents FOR DELETE USING (is_superadmin());

-- Agent availability policies
CREATE POLICY "Everyone can read availability" ON agent_availability FOR SELECT USING (TRUE);
CREATE POLICY "Superadmin can insert availability" ON agent_availability FOR INSERT WITH CHECK (is_superadmin());
CREATE POLICY "Superadmin can update availability" ON agent_availability FOR UPDATE USING (is_superadmin());
CREATE POLICY "Superadmin can delete availability" ON agent_availability FOR DELETE USING (is_superadmin());

-- Call outcomes policies
CREATE POLICY "Operators can insert own outcomes" ON call_outcomes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Operators can read own outcomes" ON call_outcomes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Superadmin can read all outcomes" ON call_outcomes FOR SELECT USING (is_superadmin());

-- Appointments policies
CREATE POLICY "Operators can insert own appointments" ON appointments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Operators can read own appointments" ON appointments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Superadmin can read all appointments" ON appointments FOR SELECT USING (is_superadmin());
```

**Step 2: Apply in Supabase**

1. Go to Supabase dashboard -> SQL Editor
2. Paste and run the full SQL
3. Go to Authentication -> Settings -> make sure email auth is enabled
4. Create the first superadmin user manually:
   - Go to Authentication -> Users -> Add user (email + password)
   - Then in SQL Editor run:
     ```sql
     INSERT INTO users (id, email, name, role)
     VALUES ('<the-uuid-from-auth>', 'admin@hera.it', 'Admin', 'superadmin');
     ```

**Step 3: Copy Supabase credentials to `.env.local`**

From Supabase dashboard -> Settings -> API:
- Copy Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
- Copy anon key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy service_role key -> `SUPABASE_SERVICE_ROLE_KEY`

**Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add database schema with RLS policies"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `src/lib/types.ts`

**Step 1: Create shared TypeScript types**

```typescript
export type UserRole = 'operatore' | 'superadmin'
export type OutcomeType = 'non_risponde' | 'negativo' | 'appuntamento'
export type AgentType = 'agente' | 'sportello'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
}

export interface Agent {
  id: string
  name: string
  type: AgentType
  active: boolean
  created_at: string
}

export interface AgentAvailability {
  id: string
  agent_id: string
  day_of_week: number // 0=lunedi ... 6=domenica
  start_time: string  // "HH:MM"
  end_time: string    // "HH:MM"
}

export interface CallOutcome {
  id: string
  user_id: string
  outcome: OutcomeType
  created_at: string
}

export interface Appointment {
  id: string
  call_outcome_id: string
  user_id: string
  agent_id: string
  client_name: string
  client_surname: string
  client_phone: string
  appointment_date: string
  appointment_time: string
  location: string
  notes: string | null
  created_at: string
}

// Join types for display
export interface AppointmentWithAgent extends Appointment {
  agents: Pick<Agent, 'name' | 'type'>
}

export interface OutcomeSummary {
  non_risponde: number
  negativo: number
  appuntamento: number
}

export interface DailyOutcomeSummary extends OutcomeSummary {
  date: string
}

export interface OperatorSummary extends OutcomeSummary {
  user_id: string
  user_name: string
  total: number
}
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TypeScript types for all entities"
```

---

## Task 4: Login Page

**Files:**
- Create: `src/app/login/page.tsx`
- Modify: `src/app/layout.tsx` (global styles, font)
- Create: `src/app/globals.css` (already exists from scaffold, update if needed)

**Step 1: Update root layout**

Edit `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Hera Appuntamenti',
  description: 'Gestione appuntamenti Heracomm',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

**Step 2: Create login page**

Create `src/app/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o password non validi')
      setLoading(false)
      return
    }

    // Fetch role to redirect
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Errore di autenticazione'); setLoading(false); return }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    router.push(profile?.role === 'superadmin' ? '/admin' : '/operatore')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Hera Appuntamenti</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Accesso...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 3: Update root page to redirect**

Edit `src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  redirect(profile?.role === 'superadmin' ? '/admin' : '/operatore')
}
```

**Step 4: Test manually**

```bash
npm run dev
```

Navigate to `http://localhost:3000` - should redirect to `/login`. Test login with the superadmin user created in Task 2.

**Step 5: Commit**

```bash
git add src/app/login/page.tsx src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add login page with Supabase auth"
```

---

## Task 5: Operator Page - Outcome Buttons + Counter

**Files:**
- Create: `src/app/operatore/page.tsx`
- Create: `src/app/operatore/actions.ts` (server actions)
- Create: `src/components/OutcomeButtons.tsx`
- Create: `src/components/DailyCounter.tsx`
- Create: `src/components/Header.tsx`

**Step 1: Create shared Header component**

Create `src/components/Header.tsx`:

```tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Header({ userName, role }: { userName: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Hera Appuntamenti</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{userName}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Esci
          </button>
        </div>
      </div>
    </header>
  )
}
```

**Step 2: Create server actions for outcomes**

Create `src/app/operatore/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OutcomeType } from '@/lib/types'

export async function recordOutcome(outcome: OutcomeType) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const { error } = await supabase
    .from('call_outcomes')
    .insert({ user_id: user.id, outcome })

  if (error) throw new Error('Errore nel salvataggio')

  revalidatePath('/operatore')
  return { success: true }
}

export async function createAppointment(formData: {
  clientName: string
  clientSurname: string
  clientPhone: string
  agentId: string
  appointmentDate: string
  appointmentTime: string
  location: string
  notes: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  // Create call outcome first
  const { data: outcome, error: outcomeError } = await supabase
    .from('call_outcomes')
    .insert({ user_id: user.id, outcome: 'appuntamento' })
    .select('id')
    .single()

  if (outcomeError || !outcome) throw new Error('Errore nel salvataggio esito')

  // Create appointment
  const { error: appointmentError } = await supabase
    .from('appointments')
    .insert({
      call_outcome_id: outcome.id,
      user_id: user.id,
      agent_id: formData.agentId,
      client_name: formData.clientName,
      client_surname: formData.clientSurname,
      client_phone: formData.clientPhone,
      appointment_date: formData.appointmentDate,
      appointment_time: formData.appointmentTime,
      location: formData.location,
      notes: formData.notes || null,
    })

  if (appointmentError) throw new Error('Errore nel salvataggio appuntamento')

  revalidatePath('/operatore')
  return { success: true }
}
```

**Step 3: Create OutcomeButtons component**

Create `src/components/OutcomeButtons.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { recordOutcome } from '@/app/operatore/actions'
import type { OutcomeType } from '@/lib/types'

export default function OutcomeButtons({ onAppointmentClick }: { onAppointmentClick: () => void }) {
  const [feedback, setFeedback] = useState<string | null>(null)

  async function handleOutcome(outcome: OutcomeType) {
    if (outcome === 'appuntamento') {
      onAppointmentClick()
      return
    }

    try {
      await recordOutcome(outcome)
      setFeedback(outcome === 'non_risponde' ? 'Non risponde registrato' : 'Negativo registrato')
      setTimeout(() => setFeedback(null), 1500)
    } catch {
      setFeedback('Errore nel salvataggio')
      setTimeout(() => setFeedback(null), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleOutcome('non_risponde')}
          className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-8 px-4 rounded-xl text-lg transition-all shadow-lg"
        >
          NON RISPONDE /<br />OCCUPATO /<br />RICHIAMARE
        </button>
        <button
          onClick={() => handleOutcome('negativo')}
          className="bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold py-8 px-4 rounded-xl text-lg transition-all shadow-lg"
        >
          NEGATIVO
        </button>
      </div>
      <button
        onClick={() => handleOutcome('appuntamento')}
        className="w-full bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold py-10 px-4 rounded-xl text-xl transition-all shadow-lg"
      >
        APPUNTAMENTO FISSATO
      </button>
      {feedback && (
        <div className="text-center py-2 px-4 bg-gray-800 text-white rounded-lg animate-pulse">
          {feedback}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Create DailyCounter component**

Create `src/components/DailyCounter.tsx`:

```tsx
import type { OutcomeSummary } from '@/lib/types'

export default function DailyCounter({ counts }: { counts: OutcomeSummary }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <div className="text-2xl font-bold text-orange-600">{counts.non_risponde}</div>
        <div className="text-xs text-orange-600">Non risponde</div>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <div className="text-2xl font-bold text-red-600">{counts.negativo}</div>
        <div className="text-xs text-red-600">Negativi</div>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="text-2xl font-bold text-green-600">{counts.appuntamento}</div>
        <div className="text-xs text-green-600">Appuntamenti</div>
      </div>
    </div>
  )
}
```

**Step 5: Create operator page**

Create `src/app/operatore/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import DailyCounter from '@/components/DailyCounter'
import OperatorPageClient from './OperatorPageClient'
import type { OutcomeSummary, AppointmentWithAgent } from '@/lib/types'

export default async function OperatorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'operatore') redirect('/admin')

  // Today's counts
  const today = new Date().toISOString().split('T')[0]
  const { data: outcomes } = await supabase
    .from('call_outcomes')
    .select('outcome')
    .eq('user_id', user.id)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)

  const counts: OutcomeSummary = { non_risponde: 0, negativo: 0, appuntamento: 0 }
  outcomes?.forEach(o => { counts[o.outcome as keyof OutcomeSummary]++ })

  // Today's appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, agents(name, type)')
    .eq('user_id', user.id)
    .eq('appointment_date', today)
    .order('appointment_time')

  // Active agents for the form
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, type')
    .eq('active', true)
    .order('name')

  // Agent availability
  const { data: availability } = await supabase
    .from('agent_availability')
    .select('*')

  return (
    <div className="min-h-screen bg-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <DailyCounter counts={counts} />
        <OperatorPageClient
          agents={agents || []}
          availability={availability || []}
          todayAppointments={(appointments as AppointmentWithAgent[]) || []}
        />
      </main>
    </div>
  )
}
```

**Step 6: Create client wrapper for operator page**

Create `src/app/operatore/OperatorPageClient.tsx`:

```tsx
'use client'

import { useState } from 'react'
import OutcomeButtons from '@/components/OutcomeButtons'
import AppointmentModal from '@/components/AppointmentModal'
import type { Agent, AgentAvailability, AppointmentWithAgent } from '@/lib/types'

export default function OperatorPageClient({
  agents,
  availability,
  todayAppointments,
}: {
  agents: Pick<Agent, 'id' | 'name' | 'type'>[]
  availability: AgentAvailability[]
  todayAppointments: AppointmentWithAgent[]
}) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <OutcomeButtons onAppointmentClick={() => setShowModal(true)} />

      {showModal && (
        <AppointmentModal
          agents={agents}
          availability={availability}
          onClose={() => setShowModal(false)}
        />
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Appuntamenti di oggi ({todayAppointments.length})
        </h2>
        {todayAppointments.length === 0 ? (
          <p className="text-gray-500 text-sm">Nessun appuntamento oggi</p>
        ) : (
          <div className="space-y-2">
            {todayAppointments.map((apt) => (
              <div key={apt.id} className="bg-white rounded-lg p-3 shadow-sm border">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">{apt.appointment_time.slice(0, 5)}</span>
                    {' '}
                    <span>{apt.client_name} {apt.client_surname}</span>
                  </div>
                  <span className="text-sm text-gray-500">{apt.agents?.name}</span>
                </div>
                {apt.location && (
                  <div className="text-sm text-gray-500 mt-1">{apt.location}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
```

**Step 7: Commit**

```bash
git add src/app/operatore/ src/components/Header.tsx src/components/OutcomeButtons.tsx src/components/DailyCounter.tsx
git commit -m "feat: add operator page with outcome buttons and daily counter"
```

---

## Task 6: Appointment Modal with Availability Check

**Files:**
- Create: `src/components/AppointmentModal.tsx`

**Step 1: Create AppointmentModal component**

Create `src/components/AppointmentModal.tsx`:

```tsx
'use client'

import { useState, useMemo } from 'react'
import { createAppointment } from '@/app/operatore/actions'
import type { Agent, AgentAvailability } from '@/lib/types'

const DAY_NAMES = ['Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato', 'Domenica']

// Convert JS Date.getDay() (0=Sun) to our schema (0=Mon)
function jsToSchemaDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

export default function AppointmentModal({
  agents,
  availability,
  onClose,
}: {
  agents: Pick<Agent, 'id' | 'name' | 'type'>[]
  availability: AgentAvailability[]
  onClose: () => void
}) {
  const [form, setForm] = useState({
    clientName: '',
    clientSurname: '',
    clientPhone: '',
    agentId: '',
    appointmentDate: '',
    appointmentTime: '',
    location: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Availability for selected agent
  const agentAvailability = useMemo(() => {
    if (!form.agentId) return []
    return availability.filter(a => a.agent_id === form.agentId)
  }, [form.agentId, availability])

  // Available days for selected agent (for date input min/validation)
  const availableDays = useMemo(() => {
    return new Set(agentAvailability.map(a => a.day_of_week))
  }, [agentAvailability])

  // Time slots for selected agent + date
  const timeSlots = useMemo(() => {
    if (!form.agentId || !form.appointmentDate) return []
    const date = new Date(form.appointmentDate)
    const schemaDay = jsToSchemaDay(date.getDay())
    return agentAvailability
      .filter(a => a.day_of_week === schemaDay)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [form.agentId, form.appointmentDate, agentAvailability])

  // Validate date is an available day
  function isDateAvailable(dateStr: string): boolean {
    if (!dateStr || availableDays.size === 0) return false
    const date = new Date(dateStr)
    return availableDays.has(jsToSchemaDay(date.getDay()))
  }

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    // Reset dependent fields
    if (field === 'agentId') setForm(prev => ({ ...prev, [field]: value, appointmentDate: '', appointmentTime: '' }))
    if (field === 'appointmentDate') setForm(prev => ({ ...prev, [field]: value, appointmentTime: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!isDateAvailable(form.appointmentDate)) {
      setError('La data selezionata non e\' disponibile per questo agente')
      return
    }

    setSaving(true)
    try {
      await createAppointment(form)
      onClose()
    } catch {
      setError('Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Nuovo Appuntamento</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text" required value={form.clientName}
                onChange={e => update('clientName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
              <input
                type="text" required value={form.clientSurname}
                onChange={e => update('clientSurname', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cellulare</label>
            <input
              type="tel" required value={form.clientPhone}
              onChange={e => update('clientPhone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agente / Sportello</label>
            <select
              required value={form.agentId}
              onChange={e => update('agentId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Seleziona...</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type === 'agente' ? 'Agente' : 'Sportello'})
                </option>
              ))}
            </select>
          </div>

          {form.agentId && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              Disponibile: {agentAvailability.length === 0
                ? 'Nessuna disponibilita\' impostata'
                : [...new Set(agentAvailability.map(a => a.day_of_week))].sort().map(d => DAY_NAMES[d]).join(', ')
              }
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input
              type="date" required value={form.appointmentDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => update('appointmentDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            {form.appointmentDate && !isDateAvailable(form.appointmentDate) && (
              <p className="text-red-500 text-xs mt-1">L'agente non e' disponibile in questo giorno</p>
            )}
          </div>

          {timeSlots.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ora</label>
              <select
                required value={form.appointmentTime}
                onChange={e => update('appointmentTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Seleziona fascia...</option>
                {timeSlots.map((slot, i) => (
                  <option key={i} value={slot.start_time}>
                    {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Luogo</label>
            <input
              type="text" required value={form.location}
              onChange={e => update('location', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Salvataggio...' : 'SALVA APPUNTAMENTO'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 2: Test manually**

- Login as operator
- Click each of the 3 buttons
- Verify counter updates
- Fill and submit the appointment form
- Verify appointment shows in list

**Step 3: Commit**

```bash
git add src/components/AppointmentModal.tsx src/app/operatore/OperatorPageClient.tsx
git commit -m "feat: add appointment modal with availability checking"
```

---

## Task 7: Admin Dashboard - Report Data + Summary Cards

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/AdminDashboard.tsx`
- Create: `src/components/SummaryCards.tsx`
- Create: `src/components/Filters.tsx`

**Step 1: Create Filters component**

Create `src/components/Filters.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type { User, Agent } from '@/lib/types'

export default function Filters({
  operators,
  agents,
}: {
  operators: Pick<User, 'id' | 'name'>[]
  agents: Pick<Agent, 'id' | 'name' | 'type'>[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '')
  const [operatorId, setOperatorId] = useState(searchParams.get('operator') || '')
  const [agentId, setAgentId] = useState(searchParams.get('agent') || '')

  function applyFilters() {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    if (operatorId) params.set('operator', operatorId)
    if (agentId) params.set('agent', agentId)
    router.push(`/admin?${params.toString()}`)
  }

  function resetFilters() {
    setDateFrom('')
    setDateTo('')
    setOperatorId('')
    setAgentId('')
    router.push('/admin')
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Da</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">A</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Operatrice</label>
          <select value={operatorId} onChange={e => setOperatorId(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="">Tutte</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Agente/Sportello</label>
          <select value={agentId} onChange={e => setAgentId(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="">Tutti</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={applyFilters}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
          Applica
        </button>
        <button onClick={resetFilters}
          className="text-gray-600 px-4 py-1.5 rounded text-sm hover:bg-gray-100">
          Reset
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Create SummaryCards component**

Create `src/components/SummaryCards.tsx`:

```tsx
import type { OutcomeSummary } from '@/lib/types'

export default function SummaryCards({ counts }: { counts: OutcomeSummary }) {
  const total = counts.non_risponde + counts.negativo + counts.appuntamento
  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-orange-600">{counts.non_risponde}</div>
        <div className="text-sm text-orange-600">Non risponde</div>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-red-600">{counts.negativo}</div>
        <div className="text-sm text-red-600">Negativi</div>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-green-600">{counts.appuntamento}</div>
        <div className="text-sm text-green-600">Appuntamenti</div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-blue-600">{total}</div>
        <div className="text-sm text-blue-600">Totale</div>
      </div>
    </div>
  )
}
```

**Step 3: Create admin page (server component with data fetching)**

Create `src/app/admin/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import Filters from '@/components/Filters'
import SummaryCards from '@/components/SummaryCards'
import AdminDashboard from './AdminDashboard'
import type { OutcomeSummary } from '@/lib/types'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; operator?: string; agent?: string }>
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

  if (!profile || profile.role !== 'superadmin') redirect('/operatore')

  // Default date range: today
  const today = new Date().toISOString().split('T')[0]
  const dateFrom = params.from || today
  const dateTo = params.to || today

  // Fetch operators list (for filter dropdown)
  const { data: operators } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'operatore')
    .order('name')

  // Fetch agents list (for filter dropdown)
  const { data: allAgents } = await supabase
    .from('agents')
    .select('id, name, type')
    .order('name')

  // Build call_outcomes query with filters
  let outcomesQuery = supabase
    .from('call_outcomes')
    .select('*')
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59`)

  if (params.operator) {
    outcomesQuery = outcomesQuery.eq('user_id', params.operator)
  }

  const { data: outcomes } = await outcomesQuery

  // Build appointments query with filters
  let appointmentsQuery = supabase
    .from('appointments')
    .select('*, agents(name, type), users!appointments_user_id_fkey(name)')
    .gte('appointment_date', dateFrom)
    .lte('appointment_date', dateTo)
    .order('appointment_date')
    .order('appointment_time')

  if (params.operator) {
    appointmentsQuery = appointmentsQuery.eq('user_id', params.operator)
  }
  if (params.agent) {
    appointmentsQuery = appointmentsQuery.eq('agent_id', params.agent)
  }

  const { data: appointments } = await appointmentsQuery

  // Calculate summary
  const counts: OutcomeSummary = { non_risponde: 0, negativo: 0, appuntamento: 0 }
  outcomes?.forEach(o => { counts[o.outcome as keyof OutcomeSummary]++ })

  // Calculate per-operator summary
  const operatorMap = new Map<string, OutcomeSummary & { user_name: string }>()
  outcomes?.forEach(o => {
    if (!operatorMap.has(o.user_id)) {
      const op = operators?.find(op => op.id === o.user_id)
      operatorMap.set(o.user_id, {
        user_name: op?.name || 'Sconosciuto',
        non_risponde: 0, negativo: 0, appuntamento: 0
      })
    }
    const entry = operatorMap.get(o.user_id)!
    entry[o.outcome as keyof OutcomeSummary]++
  })

  const operatorSummaries = Array.from(operatorMap.entries()).map(([id, data]) => ({
    user_id: id,
    ...data,
    total: data.non_risponde + data.negativo + data.appuntamento
  }))

  // Calculate daily data for charts
  const dailyMap = new Map<string, OutcomeSummary>()
  outcomes?.forEach(o => {
    const date = o.created_at.split('T')[0]
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { non_risponde: 0, negativo: 0, appuntamento: 0 })
    }
    dailyMap.get(date)![o.outcome as keyof OutcomeSummary]++
  })

  const dailyData = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="min-h-screen bg-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Filters operators={operators || []} agents={allAgents || []} />
        <SummaryCards counts={counts} />
        <AdminDashboard
          dailyData={dailyData}
          operatorSummaries={operatorSummaries}
          appointments={appointments || []}
          counts={counts}
        />
      </main>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/components/Filters.tsx src/components/SummaryCards.tsx
git commit -m "feat: add admin page with filters and summary cards"
```

---

## Task 8: Admin Dashboard - Charts + Tables + CSV Export

**Files:**
- Create: `src/app/admin/AdminDashboard.tsx`

**Step 1: Create AdminDashboard client component**

Create `src/app/admin/AdminDashboard.tsx`:

```tsx
'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import type { OutcomeSummary, DailyOutcomeSummary, OperatorSummary } from '@/lib/types'

const COLORS = { non_risponde: '#f97316', negativo: '#ef4444', appuntamento: '#22c55e' }

interface AppointmentRow {
  id: string
  client_name: string
  client_surname: string
  client_phone: string
  appointment_date: string
  appointment_time: string
  location: string
  notes: string | null
  agents: { name: string; type: string } | null
  users: { name: string } | null
}

export default function AdminDashboard({
  dailyData,
  operatorSummaries,
  appointments,
  counts,
}: {
  dailyData: DailyOutcomeSummary[]
  operatorSummaries: OperatorSummary[]
  appointments: AppointmentRow[]
  counts: OutcomeSummary
}) {
  const total = counts.non_risponde + counts.negativo + counts.appuntamento
  const pieData = [
    { name: 'Non risponde', value: counts.non_risponde, color: COLORS.non_risponde },
    { name: 'Negativi', value: counts.negativo, color: COLORS.negativo },
    { name: 'Appuntamenti', value: counts.appuntamento, color: COLORS.appuntamento },
  ].filter(d => d.value > 0)

  function exportCSV() {
    const headers = ['Data', 'Ora', 'Cliente', 'Telefono', 'Agente', 'Luogo', 'Note', 'Operatrice']
    const rows = appointments.map(a => [
      a.appointment_date,
      a.appointment_time?.slice(0, 5),
      `${a.client_name} ${a.client_surname}`,
      a.client_phone,
      a.agents?.name || '',
      a.location,
      a.notes || '',
      a.users?.name || '',
    ])

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appuntamenti-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Charts */}
      {dailyData.length > 1 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <h3 className="font-semibold text-gray-700 mb-4">Andamento giornaliero</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="non_risponde" name="Non risponde" stroke={COLORS.non_risponde} strokeWidth={2} />
              <Line type="monotone" dataKey="negativo" name="Negativi" stroke={COLORS.negativo} strokeWidth={2} />
              <Line type="monotone" dataKey="appuntamento" name="Appuntamenti" stroke={COLORS.appuntamento} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {total > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <h3 className="font-semibold text-gray-700 mb-4">Distribuzione esiti</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Operator table */}
      {operatorSummaries.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border overflow-x-auto">
          <h3 className="font-semibold text-gray-700 mb-4">Riepilogo per operatrice</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Operatrice</th>
                <th className="pb-2 text-center">Non risp.</th>
                <th className="pb-2 text-center">Negativi</th>
                <th className="pb-2 text-center">Appuntamenti</th>
                <th className="pb-2 text-center font-bold">Totale</th>
              </tr>
            </thead>
            <tbody>
              {operatorSummaries.map(op => (
                <tr key={op.user_id} className="border-b">
                  <td className="py-2">{op.user_name}</td>
                  <td className="py-2 text-center text-orange-600">{op.non_risponde}</td>
                  <td className="py-2 text-center text-red-600">{op.negativo}</td>
                  <td className="py-2 text-center text-green-600">{op.appuntamento}</td>
                  <td className="py-2 text-center font-bold">{op.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Appointments list */}
      <div className="bg-white rounded-lg p-4 shadow-sm border overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700">Appuntamenti fissati ({appointments.length})</h3>
          {appointments.length > 0 && (
            <button onClick={exportCSV}
              className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200">
              Export CSV
            </button>
          )}
        </div>
        {appointments.length === 0 ? (
          <p className="text-gray-500 text-sm">Nessun appuntamento nel periodo selezionato</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Data</th>
                <th className="pb-2">Ora</th>
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Telefono</th>
                <th className="pb-2">Agente</th>
                <th className="pb-2">Luogo</th>
                <th className="pb-2">Operatrice</th>
                <th className="pb-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{a.appointment_date}</td>
                  <td className="py-2">{a.appointment_time?.slice(0, 5)}</td>
                  <td className="py-2">{a.client_name} {a.client_surname}</td>
                  <td className="py-2">{a.client_phone}</td>
                  <td className="py-2">{a.agents?.name}</td>
                  <td className="py-2">{a.location}</td>
                  <td className="py-2">{a.users?.name}</td>
                  <td className="py-2 text-gray-500">{a.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/admin/AdminDashboard.tsx
git commit -m "feat: add admin dashboard with charts, tables and CSV export"
```

---

## Task 9: Admin - Agent/Sportello Management (CRUD + Availability)

**Files:**
- Create: `src/app/admin/gestione/page.tsx`
- Create: `src/app/admin/gestione/agents/AgentManager.tsx`
- Create: `src/app/admin/gestione/actions.ts`

**Step 1: Create server actions for agent CRUD**

Create `src/app/admin/gestione/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { AgentType } from '@/lib/types'

// --- Agent CRUD ---

export async function createAgent(data: { name: string; type: AgentType }) {
  const supabase = await createClient()
  const { error } = await supabase.from('agents').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gestione')
}

export async function updateAgent(id: string, data: { name: string; type: AgentType; active: boolean }) {
  const supabase = await createClient()
  const { error } = await supabase.from('agents').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gestione')
}

export async function deleteAgent(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('agents').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gestione')
}

// --- Availability CRUD ---

export async function setAgentAvailability(agentId: string, slots: { day_of_week: number; start_time: string; end_time: string }[]) {
  const supabase = await createClient()

  // Delete existing availability for this agent
  await supabase.from('agent_availability').delete().eq('agent_id', agentId)

  // Insert new slots
  if (slots.length > 0) {
    const { error } = await supabase.from('agent_availability').insert(
      slots.map(s => ({ agent_id: agentId, ...s }))
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/gestione')
  revalidatePath('/operatore')
}

// --- Operator CRUD ---

export async function createOperator(data: { email: string; password: string; name: string }) {
  const adminClient = createAdminClient()

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })

  if (authError) throw new Error(authError.message)

  // Create profile
  const supabase = await createClient()
  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    email: data.email,
    name: data.name,
    role: 'operatore',
  })

  if (profileError) throw new Error(profileError.message)
  revalidatePath('/admin/gestione')
}

export async function updateOperator(id: string, data: { name: string }) {
  const supabase = await createClient()
  const { error } = await supabase.from('users').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gestione')
}

export async function deleteOperator(id: string) {
  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)
  // Profile will cascade delete
  revalidatePath('/admin/gestione')
}
```

**Step 2: Create AgentManager component**

Create `src/app/admin/gestione/AgentManager.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createAgent, updateAgent, deleteAgent, setAgentAvailability } from './actions'
import type { Agent, AgentAvailability, AgentType } from '@/lib/types'

const DAY_NAMES = ['Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato', 'Domenica']

export default function AgentManager({
  agents,
  availability,
}: {
  agents: Agent[]
  availability: AgentAvailability[]
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [editAvailId, setEditAvailId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<AgentType>('agente')
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!newName.trim()) return
    try {
      await createAgent({ name: newName, type: newType })
      setNewName('')
      setShowNew(false)
    } catch (e: any) { setError(e.message) }
  }

  async function handleToggleActive(agent: Agent) {
    try {
      await updateAgent(agent.id, { name: agent.name, type: agent.type as AgentType, active: !agent.active })
    } catch (e: any) { setError(e.message) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo agente/sportello?')) return
    try { await deleteAgent(id) } catch (e: any) { setError(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Agenti e Sportelli</h3>
        <button onClick={() => setShowNew(!showNew)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">
          + Nuovo
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {showNew && (
        <div className="bg-gray-50 p-3 rounded-lg flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Nome</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Nome agente/sportello" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Tipo</label>
            <select value={newType} onChange={e => setNewType(e.target.value as AgentType)}
              className="px-2 py-1.5 border rounded text-sm">
              <option value="agente">Agente</option>
              <option value="sportello">Sportello</option>
            </select>
          </div>
          <button onClick={handleCreate} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Salva</button>
        </div>
      )}

      <div className="space-y-2">
        {agents.map(agent => (
          <div key={agent.id} className="bg-white border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{agent.name}</span>
                <span className="text-xs ml-2 px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                  {agent.type === 'agente' ? 'Agente' : 'Sportello'}
                </span>
                {!agent.active && (
                  <span className="text-xs ml-2 px-2 py-0.5 rounded bg-red-100 text-red-600">Disattivo</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditAvailId(editAvailId === agent.id ? null : agent.id)}
                  className="text-xs text-blue-600 hover:text-blue-800">Disponibilita'</button>
                <button onClick={() => handleToggleActive(agent)}
                  className="text-xs text-yellow-600 hover:text-yellow-800">
                  {agent.active ? 'Disattiva' : 'Attiva'}
                </button>
                <button onClick={() => handleDelete(agent.id)}
                  className="text-xs text-red-600 hover:text-red-800">Elimina</button>
              </div>
            </div>

            {editAvailId === agent.id && (
              <AvailabilityEditor
                agentId={agent.id}
                slots={availability.filter(a => a.agent_id === agent.id)}
                onClose={() => setEditAvailId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AvailabilityEditor({
  agentId,
  slots: initialSlots,
  onClose,
}: {
  agentId: string
  slots: AgentAvailability[]
  onClose: () => void
}) {
  const [slots, setSlots] = useState(
    initialSlots.map(s => ({ day_of_week: s.day_of_week, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5) }))
  )
  const [saving, setSaving] = useState(false)

  function addSlot() {
    setSlots([...slots, { day_of_week: 0, start_time: '09:00', end_time: '13:00' }])
  }

  function removeSlot(i: number) {
    setSlots(slots.filter((_, idx) => idx !== i))
  }

  function updateSlot(i: number, field: string, value: string | number) {
    setSlots(slots.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  async function save() {
    setSaving(true)
    try {
      await setAgentAvailability(agentId, slots)
      onClose()
    } catch { alert('Errore nel salvataggio') }
    finally { setSaving(false) }
  }

  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <div className="text-sm font-medium text-gray-600">Fasce orarie settimanali</div>
      {slots.map((slot, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select value={slot.day_of_week} onChange={e => updateSlot(i, 'day_of_week', parseInt(e.target.value))}
            className="px-2 py-1 border rounded text-sm">
            {DAY_NAMES.map((name, idx) => <option key={idx} value={idx}>{name}</option>)}
          </select>
          <input type="time" value={slot.start_time} onChange={e => updateSlot(i, 'start_time', e.target.value)}
            className="px-2 py-1 border rounded text-sm" />
          <span className="text-gray-400">-</span>
          <input type="time" value={slot.end_time} onChange={e => updateSlot(i, 'end_time', e.target.value)}
            className="px-2 py-1 border rounded text-sm" />
          <button onClick={() => removeSlot(i)} className="text-red-500 text-sm">&times;</button>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={addSlot} className="text-xs text-blue-600">+ Aggiungi fascia</button>
        <button onClick={save} disabled={saving}
          className="bg-green-600 text-white px-3 py-1 rounded text-xs">{saving ? 'Salvo...' : 'Salva'}</button>
        <button onClick={onClose} className="text-xs text-gray-500">Annulla</button>
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/admin/gestione/
git commit -m "feat: add agent/sportello management with availability editor"
```

---

## Task 10: Admin - Operator Management

**Files:**
- Create: `src/app/admin/gestione/OperatorManager.tsx`
- Modify: `src/app/admin/gestione/page.tsx` (complete the page)

**Step 1: Create OperatorManager component**

Create `src/app/admin/gestione/OperatorManager.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createOperator, updateOperator, deleteOperator } from './actions'
import type { User } from '@/lib/types'

export default function OperatorManager({ operators }: { operators: User[] }) {
  const [showNew, setShowNew] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!newEmail || !newPassword || !newName) return
    setError('')
    try {
      await createOperator({ email: newEmail, password: newPassword, name: newName })
      setNewEmail('')
      setNewPassword('')
      setNewName('')
      setShowNew(false)
    } catch (e: any) { setError(e.message) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa operatrice?')) return
    try { await deleteOperator(id) } catch (e: any) { setError(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Operatrici</h3>
        <button onClick={() => setShowNew(!showNew)}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">
          + Nuova operatrice
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {showNew && (
        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Nome</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Nome" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm" placeholder="email@esempio.it" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Password</label>
              <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Password" />
            </div>
          </div>
          <button onClick={handleCreate} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Crea operatrice</button>
        </div>
      )}

      <div className="space-y-2">
        {operators.map(op => (
          <div key={op.id} className="bg-white border rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="font-medium">{op.name}</span>
              <span className="text-sm text-gray-500 ml-2">{op.email}</span>
            </div>
            <button onClick={() => handleDelete(op.id)}
              className="text-xs text-red-600 hover:text-red-800">Elimina</button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Create the gestione page**

Create `src/app/admin/gestione/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import AgentManager from './AgentManager'
import OperatorManager from './OperatorManager'

export default async function GestionePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'superadmin') redirect('/operatore')

  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .order('name')

  const { data: availability } = await supabase
    .from('agent_availability')
    .select('*')

  const { data: operators } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'operatore')
    .order('name')

  return (
    <div className="min-h-screen bg-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Gestione</h2>
          <a href="/admin" className="text-sm text-blue-600 hover:text-blue-800">← Dashboard</a>
        </div>
        <AgentManager agents={agents || []} availability={availability || []} />
        <OperatorManager operators={operators || []} />
      </main>
    </div>
  )
}
```

**Step 3: Add navigation link from admin dashboard to gestione**

In `src/app/admin/page.tsx`, add at the bottom of the `<main>` section, after `<AdminDashboard>`:

```tsx
<div className="flex justify-end">
  <a href="/admin/gestione"
    className="bg-white border rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
    Gestione Agenti e Operatrici →
  </a>
</div>
```

**Step 4: Commit**

```bash
git add src/app/admin/gestione/ src/app/admin/page.tsx
git commit -m "feat: add operator and agent management pages"
```

---

## Task 11: Deploy to Vercel

**Step 1: Create `.gitignore` (if not already present)**

Ensure `.gitignore` includes:

```
node_modules/
.next/
.env.local
```

**Step 2: Push to GitHub**

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

**Step 3: Deploy on Vercel**

1. Go to vercel.com -> Import Project -> select GitHub repo
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy

**Step 4: Update Supabase auth settings**

In Supabase dashboard -> Authentication -> URL Configuration:
- Set Site URL to your Vercel deployment URL

**Step 5: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: prepare for Vercel deployment"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | Project scaffold, Supabase clients, middleware |
| 2 | Database schema + RLS policies |
| 3 | TypeScript types |
| 4 | Login page |
| 5 | Operator page: buttons + counter + daily agenda |
| 6 | Appointment modal with availability |
| 7 | Admin: filters + summary cards |
| 8 | Admin: charts + tables + CSV export |
| 9 | Admin: agent/sportello CRUD + availability |
| 10 | Admin: operator CRUD |
| 11 | Deploy to Vercel |
