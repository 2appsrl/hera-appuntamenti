export type UserRole = 'operatore' | 'superadmin' | 'agente'
export type OutcomeType = 'non_risponde' | 'negativo' | 'appuntamento'
export type NegativeReason =
  | 'gia_esitato'
  | 'referente_diverso'
  | 'anagrafica_doppia'
  | 'gia_cliente'
  | 'recapito_inesistente'
  | 'altro'

export const NEGATIVE_REASON_LABELS: Record<NegativeReason, string> = {
  gia_esitato: 'Già esitato nella lista precedente',
  referente_diverso: 'Referente diverso dall\'intestatario',
  anagrafica_doppia: 'Anagrafica doppia',
  gia_cliente: 'Già cliente',
  recapito_inesistente: 'Recapito telefonico inesistente',
  altro: 'Altro',
}

export const NEGATIVE_REASON_ORDER: NegativeReason[] = [
  'gia_esitato',
  'referente_diverso',
  'anagrafica_doppia',
  'gia_cliente',
  'recapito_inesistente',
  'altro',
]

export const MAX_NEGATIVE_NOTES_LEN = 500

export type AgentType = 'agente' | 'sportello'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  monthly_call_limit: number | null
  created_at: string
}

export interface Agent {
  id: string
  name: string
  type: AgentType
  active: boolean
  address: string | null
  user_id: string | null
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
  negative_reason: NegativeReason | null
  negative_notes: string | null
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

export interface AppointmentWithAgentAndOutcome extends Appointment {
  agents: Pick<Agent, 'name' | 'type'>
  appointment_outcomes: AppointmentOutcome | null
}

export interface OutcomeSummary {
  non_risponde: number
  negativo: number
  appuntamento: number
}

export interface DailyOutcomeSummary extends OutcomeSummary {
  date: string
}

export interface CallSession {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  created_at: string
}

export interface AppointmentOutcomeSummary {
  positivo: number
  negativo: number
  non_presentato: number
  in_attesa: number
}

export interface OperatorSummary extends OutcomeSummary {
  user_id: string
  user_name: string
  total: number
  minutes_worked: number
  redemption: number // appuntamenti per ora
  appointment_outcomes: AppointmentOutcomeSummary
}

export type AppointmentOutcomeType = 'positivo' | 'negativo' | 'non_presentato'

export interface AppointmentOutcome {
  id: string
  appointment_id: string
  outcome: AppointmentOutcomeType
  notes: string | null
  created_at: string
}

export interface AppointmentForAgent extends Appointment {
  appointment_outcomes: AppointmentOutcome | null
}
