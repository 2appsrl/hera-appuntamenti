'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { MAX_NEGATIVE_NOTES_LEN } from '@/lib/types'
import type { OutcomeType, NegativeReason } from '@/lib/types'

export async function recordOutcome(
  outcome: OutcomeType,
  details?: { negativeReason?: NegativeReason; negativeNotes?: string },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  // Validazione coerenza
  if (outcome === 'negativo') {
    if (!details?.negativeReason) {
      throw new Error('Motivo obbligatorio per esito negativo')
    }
  } else if (details?.negativeReason || details?.negativeNotes) {
    throw new Error('negative_reason/notes validi solo per outcome=negativo')
  }

  const trimmedNotes = details?.negativeNotes?.trim()
  const notesValue = trimmedNotes && trimmedNotes.length > 0
    ? trimmedNotes.slice(0, MAX_NEGATIVE_NOTES_LEN)
    : null

  const admin = createAdminClient()
  const { error } = await admin
    .from('call_outcomes')
    .insert({
      user_id: user.id,
      outcome,
      negative_reason: outcome === 'negativo' ? details!.negativeReason : null,
      negative_notes: outcome === 'negativo' ? notesValue : null,
    })

  if (error) throw new Error('Errore nel salvataggio')

  // No revalidatePath — counter updates optimistically on client
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

  const admin = createAdminClient()

  // Create call outcome first
  const { data: outcome, error: outcomeError } = await admin
    .from('call_outcomes')
    .insert({ user_id: user.id, outcome: 'appuntamento' as const })
    .select('id')
    .single()

  if (outcomeError || !outcome) throw new Error('Errore nel salvataggio esito')

  // Create appointment
  const { error: appointmentError } = await admin
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

export async function startCallSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const admin = createAdminClient()
  const { error } = await admin
    .from('call_sessions')
    .insert({ user_id: user.id })

  if (error) throw new Error('Errore nell\'avvio sessione')
  revalidatePath('/operatore')
}

export async function stopCallSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const admin = createAdminClient()
  const { error } = await admin
    .from('call_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('ended_at', null)

  if (error) throw new Error('Errore nella chiusura sessione')
  revalidatePath('/operatore')
}

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
