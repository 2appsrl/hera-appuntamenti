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
    .insert({ user_id: user.id, outcome: 'appuntamento' as const })
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
