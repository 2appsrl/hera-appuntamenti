# Agent Dashboard, Appointment Outcomes & Export - Design

## 1. Fix: Appointments table empty despite count > 0

The admin dashboard shows `appointments.length` in the badge but the table renders empty. Root cause: the Supabase PostgREST query `users(name)` may fail silently because `appointments.user_id` references `users.id` but PostgREST needs the FK relationship to be discoverable. Investigate and fix the join or data rendering.

## 2. New role "agente" + Agent/Sportello Dashboard

### DB Changes

- ALTER `users.role` CHECK constraint to include `'agente'`
- Add `user_id UUID REFERENCES auth.users(id)` to `agents` table (nullable, links agent to login)
- New table `appointment_outcomes`:
  - `id UUID PK`
  - `appointment_id UUID REFERENCES appointments(id) UNIQUE`
  - `outcome TEXT CHECK (outcome IN ('positivo', 'negativo', 'non_presentato'))`
  - `notes TEXT`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
- RLS: agents can read/update outcomes for their own appointments

### Routing

- `/agente` - Agent dashboard (role: 'agente')
- Root `/` redirects based on role: superadmin -> /admin, operatore -> /operatore, agente -> /agente

### Agent Dashboard (`/agente`)

- Header with agent name
- Weekly list view: appointments for current week
- Navigation: arrows to go prev/next week
- Each appointment card shows: date, time, client name, phone, location, notes
- Outcome button per appointment: Positivo (green) / Negativo (red) / Non presentato (gray)
- Optional notes field when setting outcome
- Outcome shown as colored badge once set
- Export: CSV download + print/PDF for current week

### Admin Gestione Changes

- When creating an agent/sportello, option to also create login credentials (email/password)
- This creates an auth user + `users` row with role='agente' + links `agents.user_id`

## 3. Export Agende

- Admin dashboard: existing CSV export already works with agent filter. Fix the bug and it's functional.
- Agent dashboard: add CSV export button + browser print/PDF for weekly view
- Both admin and agent can export filtered appointment data

## User Decisions

- Agent access: dedicated login with role 'agente'
- Appointment outcomes: Positivo / Negativo / Non presentato
- Calendar view: weekly list with prev/next navigation
- Export: both from admin (filtered) and agent dashboard
