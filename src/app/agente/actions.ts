'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { AppointmentOutcomeType } from '@/lib/types'

export async function setAppointmentOutcome(appointmentId: string, outcome: AppointmentOutcomeType, notes?: string) {
  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  // Use admin client for mutation (bypasses RLS)
  const admin = createAdminClient()

  const { error } = await admin
    .from('appointment_outcomes')
    .upsert({
      appointment_id: appointmentId,
      outcome,
      notes: notes || null,
    }, { onConflict: 'appointment_id' })

  if (error) throw new Error(error.message)
  revalidatePath('/agente')
  revalidatePath('/admin/appuntamenti')
}
