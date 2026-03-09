import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import DailyCounter from '@/components/DailyCounter'
import OperatorPageClient from './OperatorPageClient'
import type { OutcomeSummary, AppointmentWithAgent } from '@/lib/types'

export default async function OperatorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'operatore') redirect('/admin')

  // Today's counts
  const today = new Date().toISOString().split('T')[0]
  const { data: outcomes } = await supabase
    .from('call_outcomes')
    .select('outcome')
    .eq('user_id', user.id)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)

  const counts: OutcomeSummary = { non_risponde: 0, negativo: 0, appuntamento: 0 }
  outcomes?.forEach(o => { counts[o.outcome as keyof OutcomeSummary]++ })

  // Today's appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, agents(name, type)')
    .eq('user_id', user.id)
    .eq('appointment_date', today)
    .order('appointment_time')

  // Active agents for the form
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, type')
    .eq('active', true)
    .order('name')

  // Agent availability
  const { data: availability } = await supabase
    .from('agent_availability')
    .select('*')

  return (
    <div className="min-h-screen bg-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <DailyCounter counts={counts} />
        <OperatorPageClient
          agents={agents || []}
          availability={availability || []}
          todayAppointments={(appointments as AppointmentWithAgent[]) || []}
        />
      </main>
    </div>
  )
}
