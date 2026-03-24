import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import AgentDashboardClient from './AgentDashboardClient'
import type { AppointmentForAgent } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AgentePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'agente') {
    redirect(profile?.role === 'superadmin' ? '/admin' : profile?.role === 'operatore' ? '/operatore' : '/login')
  }

  // Find the agent record linked to this user
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, type')
    .eq('user_id', user.id)
    .single()

  if (!agent) redirect('/login')

  // Calculate week range
  const today = new Date()
  const weekOffset = parseInt(params.week || '0')
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const mondayStr = monday.toISOString().split('T')[0]
  const sundayStr = sunday.toISOString().split('T')[0]

  // Fetch appointments for this agent this week
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, appointment_outcomes(*)')
    .eq('agent_id', agent.id)
    .gte('appointment_date', mondayStr)
    .lte('appointment_date', sundayStr)
    .order('appointment_date')
    .order('appointment_time')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={agent.name} role={profile.role} />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <AgentDashboardClient
          agentName={agent.name}
          agentType={agent.type}
          appointments={(appointments as AppointmentForAgent[]) || []}
          weekOffset={weekOffset}
          mondayStr={mondayStr}
          sundayStr={sundayStr}
        />
      </main>
    </div>
  )
}
