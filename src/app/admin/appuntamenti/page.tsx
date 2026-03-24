import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import AppointmentsPageClient from './AppointmentsPageClient'

export default async function AppuntamentiPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; agent?: string; operator?: string }>
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

  if (!profile || profile.role !== 'superadmin') {
    redirect(profile?.role === 'agente' ? '/agente' : profile?.role === 'operatore' ? '/operatore' : '/login')
  }

  // Default: today (unless explicitly set to empty via "Tutti" filter)
  const today = new Date().toISOString().split('T')[0]
  const showAll = 'from' in params && params.from === ''
  const dateFrom = showAll ? '' : (params.from || today)
  const dateTo = showAll ? '' : (params.to || today)

  // Parallel queries
  const [
    { data: agents },
    { data: operators },
    { data: appointments },
  ] = await Promise.all([
    supabase
      .from('agents')
      .select('id, name, type, address')
      .order('name'),
    supabase
      .from('users')
      .select('id, name')
      .eq('role', 'operatore')
      .order('name'),
    (() => {
      let q = supabase
        .from('appointments')
        .select('*, agents(name, type), users(name), appointment_outcomes(*)')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })

      if (dateFrom) q = q.gte('appointment_date', dateFrom)
      if (dateTo) q = q.lte('appointment_date', dateTo)
      if (params.agent) q = q.eq('agent_id', params.agent)
      if (params.operator) q = q.eq('user_id', params.operator)

      return q
    })(),
  ])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <AppointmentsPageClient
          appointments={appointments || []}
          agents={agents || []}
          operators={operators || []}
          initialFrom={dateFrom}
          initialTo={dateTo}
          initialAgent={params.agent || ''}
          initialOperator={params.operator || ''}
        />
      </main>
    </div>
  )
}
