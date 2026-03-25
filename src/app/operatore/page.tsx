import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import OperatorPageClient from './OperatorPageClient'
import type { OutcomeSummary, AppointmentWithAgent, AppointmentWithAgentAndOutcome } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function OperatorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'operatore') {
    redirect(profile?.role === 'superadmin' ? '/admin' : profile?.role === 'agente' ? '/agente' : '/login')
  }

  // Run all queries in parallel for fast page load
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: outcomes },
    { data: appointments },
    { data: agents },
    { data: availability },
    { data: activeSession },
    { data: todaySessions },
    { data: allAppointments },
  ] = await Promise.all([
    supabase
      .from('call_outcomes')
      .select('outcome')
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`),
    supabase
      .from('appointments')
      .select('*, agents(name, type)')
      .eq('user_id', user.id)
      .eq('appointment_date', today)
      .order('appointment_time'),
    supabase
      .from('agents')
      .select('id, name, type, address')
      .eq('active', true)
      .order('name'),
    supabase
      .from('agent_availability')
      .select('*'),
    supabase
      .from('call_sessions')
      .select('id, started_at')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('call_sessions')
      .select('started_at, ended_at')
      .eq('user_id', user.id)
      .gte('started_at', `${today}T00:00:00`)
      .not('ended_at', 'is', null),
    supabase
      .from('appointments')
      .select('*, agents(name, type), appointment_outcomes(*)')
      .eq('user_id', user.id)
      .order('appointment_date')
      .order('appointment_time'),
  ])

  const counts: OutcomeSummary = { non_risponde: 0, negativo: 0, appuntamento: 0 }
  outcomes?.forEach(o => { counts[o.outcome as keyof OutcomeSummary]++ })

  // Normalize appointment_outcomes: Supabase may return array or object depending on relation detection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedAppointments: AppointmentWithAgentAndOutcome[] = (allAppointments || []).map((a: any) => ({
    ...a,
    appointment_outcomes: Array.isArray(a.appointment_outcomes)
      ? (a.appointment_outcomes[0] || null)
      : (a.appointment_outcomes || null),
  }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <OperatorPageClient
          agents={agents || []}
          availability={availability || []}
          todayAppointments={(appointments as AppointmentWithAgent[]) || []}
          allAppointments={normalizedAppointments}
          initialCounts={counts}
          activeSessionStartedAt={activeSession?.started_at || null}
          todayMinutesWorked={
            (todaySessions || []).reduce((acc, s) => {
              const start = new Date(s.started_at).getTime()
              const end = new Date(s.ended_at!).getTime()
              return acc + (end - start) / 60000
            }, 0)
          }
        />
      </main>
    </div>
  )
}
