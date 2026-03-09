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
