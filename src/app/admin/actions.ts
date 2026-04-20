'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateAppointmentAgent(appointmentId: string, agentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  // Verify superadmin
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') throw new Error('Non autorizzato')

  // Use admin client for mutations (bypasses RLS)
  const admin = createAdminClient()

  // Get agent info for auto-updating location if sportello
  const { data: agent } = await admin
    .from('agents')
    .select('name, type, address')
    .eq('id', agentId)
    .single()

  if (!agent) throw new Error('Agente non trovato')

  const updateData: { agent_id: string; location?: string } = { agent_id: agentId }

  // If switching to a sportello, auto-update location to sportello address
  if (agent.type === 'sportello' && agent.address) {
    updateData.location = agent.address
  }

  const { error } = await admin
    .from('appointments')
    .update(updateData)
    .eq('id', appointmentId)

  if (error) throw new Error('Errore nell\'aggiornamento')

  revalidatePath('/admin')
  revalidatePath('/admin/appuntamenti')
  revalidatePath('/agente')
  return { success: true, agentName: agent.name, agentType: agent.type }
}

export async function deleteAppointment(appointmentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') throw new Error('Non autorizzato')

  // Use admin client for mutations (bypasses RLS)
  const admin = createAdminClient()

  const { data: appointment } = await admin
    .from('appointments')
    .select('call_outcome_id')
    .eq('id', appointmentId)
    .single()

  // Delete appointment outcomes first (FK constraint)
  await admin
    .from('appointment_outcomes')
    .delete()
    .eq('appointment_id', appointmentId)

  const { error } = await admin
    .from('appointments')
    .delete()
    .eq('id', appointmentId)

  if (error) throw new Error('Errore nell\'eliminazione')

  // Also delete the originating call_outcome so dashboard counts stay in sync
  if (appointment?.call_outcome_id) {
    await admin
      .from('call_outcomes')
      .delete()
      .eq('id', appointment.call_outcome_id)
  }

  revalidatePath('/admin')
  revalidatePath('/admin/appuntamenti')
  revalidatePath('/admin/kpi')
  return { success: true }
}
