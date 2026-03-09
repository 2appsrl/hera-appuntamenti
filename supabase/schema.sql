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
