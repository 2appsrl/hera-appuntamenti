import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/Header'
import AppointmentsPageClient from './AppointmentsPageClient'

export const dynamic = 'force-dynamic'

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

  // Use admin client to bypass RLS — user is already verified as superadmin above
  const admin = createAdminClient()

  // Parallel queries — fetch appointments WITHOUT joins to avoid filtering issues
  const [
    { data: agents },
    { data: operators },
    { data: rawAppointments },
    { data: outcomes },
  ] = await Promise.all([
    admin
      .from('agents')
      .select('id, name, type, address')
      .order('name'),
    admin
      .from('users')
      .select('id, name')
      .eq('role', 'operatore')
      .order('name'),
    (() => {
      let q = admin
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })

      if (dateFrom) q = q.gte('appointment_date', dateFrom)
      if (dateTo) q = q.lte('appointment_date', dateTo)
      if (params.agent) q = q.eq('agent_id', params.agent)
      if (params.operator) q = q.eq('user_id', params.operator)

      return q
    })(),
    admin
      .from('appointment_outcomes')
      .select('*'),
  ])

  // Build lookup maps
  const agentMap = new Map((agents || []).map(a => [a.id, a]))
  const operatorMap = new Map((operators || []).map(o => [o.id, o]))
  // Also add all users (not just operators) for the user_id lookup
  const { data: allUsers } = await admin.from('users').select('id, name')
  const userMap = new Map((allUsers || []).map(u => [u.id, u]))
  const outcomeMap = new Map((outcomes || []).map(o => [o.appointment_id, o]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedAppointments = (rawAppointments || []).map((a: any) => {
    const agent = agentMap.get(a.agent_id)
    const user = userMap.get(a.user_id)
    const outcome = outcomeMap.get(a.id)
    return {
      ...a,
      agents: agent ? { name: agent.name, type: agent.type } : null,
      users: user ? { name: user.name } : null,
      appointment_outcomes: outcome || null,
    }
  })

  // DEBUG: temporary - remove after fix
  console.log('[DEBUG appointments]', {
    showAll,
    dateFrom,
    dateTo,
    rawCount: rawAppointments?.length,
    normalizedCount: normalizedAppointments.length,
    params,
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={profile.name} role={profile.role} />
      {/* DEBUG: temporary */}
      <pre className="text-xs bg-yellow-100 p-2 mx-4">
        {JSON.stringify({ showAll, dateFrom, dateTo, rawCount: rawAppointments?.length, normalizedCount: normalizedAppointments.length, params }, null, 2)}
      </pre>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <AppointmentsPageClient
          appointments={normalizedAppointments}
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
