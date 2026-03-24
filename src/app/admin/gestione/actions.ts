'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { AgentType } from '@/lib/types'

// --- Agent CRUD ---

export async function createAgent(data: { name: string; type: AgentType; address?: string }) {
  const admin = createAdminClient()
  const { error } = await admin.from('agents').insert({
    name: data.name,
    type: data.type,
    address: data.type === 'sportello' ? (data.address || null) : null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gestione')
}

export async function updateAgent(id: string, data: { name: string; type: AgentType; active: boolean; address?: string }) {
  const admin = createAdminClient()
  const { error } = await admin.from('agents').update({
    name: data.name,
    type: data.type,
    active: data.active,
    address: data.type === 'sportello' ? (data.address || null) : null,
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gestione')
}

export async function deleteAgent(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('agents').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/gestione')
}

// --- Availability CRUD ---

export async function setAgentAvailability(agentId: string, slots: { day_of_week: number; start_time: string; end_time: string }[]) {
  const admin = createAdminClient()

  // Delete existing availability for this agent
  await admin.from('agent_availability').delete().eq('agent_id', agentId)

  // Insert new slots
  if (slots.length > 0) {
    const { error } = await admin.from('agent_availability').insert(
      slots.map(s => ({ agent_id: agentId, ...s }))
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/gestione')
  revalidatePath('/operatore')
}

// --- Operator CRUD ---

export async function createOperator(data: { email: string; password: string; name: string }) {
  const admin = createAdminClient()

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })

  if (authError) throw new Error(authError.message)

  // Create profile
  const { error: profileError } = await admin.from('users').insert({
    id: authData.user.id,
    email: data.email,
    name: data.name,
    role: 'operatore',
  })

  if (profileError) throw new Error(profileError.message)
  revalidatePath('/admin/gestione')
}

// --- Agent User (login) ---

export async function createAgentUser(agentId: string, data: { email: string; password: string; name: string }) {
  const admin = createAdminClient()

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })

  if (authError) throw new Error(authError.message)

  const { error: profileError } = await admin.from('users').insert({
    id: authData.user.id,
    email: data.email,
    name: data.name,
    role: 'agente',
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    throw new Error(profileError.message)
  }

  const { error: linkError } = await admin.from('agents').update({ user_id: authData.user.id }).eq('id', agentId)

  if (linkError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    throw new Error(linkError.message)
  }

  revalidatePath('/admin/gestione')
}

export async function deleteOperator(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)
  // Profile will cascade delete
  revalidatePath('/admin/gestione')
}
