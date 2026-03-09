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

export async function deleteOperator(id: string) {
  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)
  // Profile will cascade delete
  revalidatePath('/admin/gestione')
}
