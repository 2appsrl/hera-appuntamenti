import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import Filters from '@/components/Filters'
import SummaryCards from '@/components/SummaryCards'
import AdminDashboard from './AdminDashboard'
import type { OutcomeSummary } from '@/lib/types'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; operator?: string; agent?: string }>
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

  // Default date range: today (unless explicitly set to empty via "Tutti" filter)
  const today = new Date().toISOString().split('T')[0]
  const showAll = 'from' in params && params.from === ''
  const dateFrom = showAll ? '' : (params.from || today)
  const dateTo = showAll ? '' : (params.to || today)

  // Fetch operators list (for filter dropdown)
  const { data: operators } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'operatore')
    .order('name')

  // Fetch agents list (for filter dropdown + appointment reassignment)
  const { data: allAgents } = await supabase
    .from('agents')
    .select('id, name, type, address')
    .order('name')

  // Build call_outcomes query with filters
  let outcomesQuery = supabase
    .from('call_outcomes')
    .select('*')

  if (dateFrom) outcomesQuery = outcomesQuery.gte('created_at', `${dateFrom}T00:00:00`)
  if (dateTo) outcomesQuery = outcomesQuery.lte('created_at', `${dateTo}T23:59:59`)

  if (params.operator) {
    outcomesQuery = outcomesQuery.eq('user_id', params.operator)
  }

  const { data: outcomes } = await outcomesQuery

  // Fetch call sessions for the period
  let sessionsQuery = supabase
    .from('call_sessions')
    .select('user_id, started_at, ended_at')
    .not('ended_at', 'is', null)

  if (dateFrom) sessionsQuery = sessionsQuery.gte('started_at', `${dateFrom}T00:00:00`)
  if (dateTo) sessionsQuery = sessionsQuery.lte('started_at', `${dateTo}T23:59:59`)

  if (params.operator) {
    sessionsQuery = sessionsQuery.eq('user_id', params.operator)
  }

  const { data: callSessions } = await sessionsQuery

  // Calculate summary
  const counts: OutcomeSummary = { non_risponde: 0, negativo: 0, appuntamento: 0 }
  outcomes?.forEach(o => { counts[o.outcome as keyof OutcomeSummary]++ })

  // Calculate per-operator summary
  const operatorMap = new Map<string, { user_name: string; non_risponde: number; negativo: number; appuntamento: number }>()
  outcomes?.forEach(o => {
    if (!operatorMap.has(o.user_id)) {
      const op = operators?.find(op => op.id === o.user_id)
      operatorMap.set(o.user_id, {
        user_name: op?.name || 'Sconosciuto',
        non_risponde: 0, negativo: 0, appuntamento: 0
      })
    }
    const entry = operatorMap.get(o.user_id)!
    entry[o.outcome as keyof OutcomeSummary]++
  })

  // Calculate minutes worked per operator from call sessions
  const minutesMap = new Map<string, number>()
  callSessions?.forEach(s => {
    const mins = (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 60000
    minutesMap.set(s.user_id, (minutesMap.get(s.user_id) || 0) + mins)
  })

  const operatorSummaries = Array.from(operatorMap.entries()).map(([id, data]) => {
    const total = data.non_risponde + data.negativo + data.appuntamento
    const minutesWorked = minutesMap.get(id) || 0
    const hoursWorked = minutesWorked / 60
    return {
      user_id: id,
      ...data,
      total,
      minutes_worked: Math.round(minutesWorked),
      redemption: hoursWorked > 0 ? Math.round((data.appuntamento / hoursWorked) * 10) / 10 : 0,
      appointment_outcomes: { positivo: 0, negativo: 0, non_presentato: 0, in_attesa: 0 },
    }
  })

  // Calculate daily data for charts
  const dailyMap = new Map<string, OutcomeSummary>()
  outcomes?.forEach(o => {
    const date = o.created_at.split('T')[0]
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { non_risponde: 0, negativo: 0, appuntamento: 0 })
    }
    dailyMap.get(date)![o.outcome as keyof OutcomeSummary]++
  })

  const dailyData = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <Suspense fallback={null}>
          <Filters operators={operators || []} agents={allAgents || []} />
        </Suspense>
        <SummaryCards counts={counts} />
        <AdminDashboard
          dailyData={dailyData}
          operatorSummaries={operatorSummaries}
          counts={counts}
        />
        <div className="flex justify-end">
          <a href="/admin/gestione"
            className="group flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:shadow-md transition-all">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Gestione Agenti e Operatrici
            <svg className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </main>
    </div>
  )
}
