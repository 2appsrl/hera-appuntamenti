-- Users profile table (linked to auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('operatore', 'superadmin', 'agente')),
  monthly_call_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add monthly_call_limit if upgrading from older schema
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_call_limit INTEGER;

-- Agents and sportelli
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('agente', 'sportello')),
  active BOOLEAN DEFAULT TRUE,
  address TEXT,
  user_id UUID REFERENCES auth.users(id),
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
  negative_reason TEXT CHECK (negative_reason IN ('gia_esitato','referente_diverso','anagrafica_doppia','gia_cliente','recapito_inesistente','altro')),
  negative_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_outcomes_negative_reason
  ON call_outcomes(negative_reason)
  WHERE outcome = 'negativo';

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

-- Appointment outcomes (agent feedback)
CREATE TABLE appointment_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE UNIQUE,
  outcome TEXT NOT NULL CHECK (outcome IN ('positivo', 'negativo', 'non_presentato')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call sessions (operator call time tracking)
CREATE TABLE call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_call_outcomes_user_date ON call_outcomes(user_id, created_at);
CREATE INDEX idx_call_outcomes_created_at ON call_outcomes(created_at);
CREATE INDEX idx_appointments_user_date ON appointments(user_id, appointment_date);
CREATE INDEX idx_appointments_agent_date ON appointments(agent_id, appointment_date);
CREATE INDEX idx_appointment_outcomes_appointment ON appointment_outcomes(appointment_id);
CREATE INDEX idx_call_sessions_user_date ON call_sessions(user_id, started_at);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;

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

-- Helper function: get agent_id linked to current user
CREATE OR REPLACE FUNCTION my_agent_id()
RETURNS UUID AS $$
  SELECT id FROM agents WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Agents can read their own appointments
CREATE POLICY "Agents can read own appointments" ON appointments FOR SELECT
  USING (agent_id = my_agent_id());

-- Appointment outcomes policies
CREATE POLICY "Agents can insert own outcomes" ON appointment_outcomes FOR INSERT
  WITH CHECK (appointment_id IN (SELECT id FROM appointments WHERE agent_id = my_agent_id()));
CREATE POLICY "Agents can update own outcomes" ON appointment_outcomes FOR UPDATE
  USING (appointment_id IN (SELECT id FROM appointments WHERE agent_id = my_agent_id()));
CREATE POLICY "Agents can read own outcomes" ON appointment_outcomes FOR SELECT
  USING (appointment_id IN (SELECT id FROM appointments WHERE agent_id = my_agent_id()));
CREATE POLICY "Superadmin can read all outcomes" ON appointment_outcomes FOR SELECT
  USING (is_superadmin());
CREATE POLICY "Operators can read related outcomes" ON appointment_outcomes FOR SELECT
  USING (appointment_id IN (SELECT id FROM appointments WHERE user_id = auth.uid()));

-- Call sessions policies
CREATE POLICY "Operators can insert own sessions" ON call_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Operators can update own sessions" ON call_sessions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Operators can read own sessions" ON call_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Superadmin can read all sessions" ON call_sessions FOR SELECT USING (is_superadmin());

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
