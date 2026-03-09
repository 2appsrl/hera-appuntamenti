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

  if (!profile || profile.role !== 'superadmin') redirect('/operatore')

  // Default date range: today
  const today = new Date().toISOString().split('T')[0]
  const dateFrom = params.from || today
  const dateTo = params.to || today

  // Fetch operators list (for filter dropdown)
  const { data: operators } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'operatore')
    .order('name')

  // Fetch agents list (for filter dropdown)
  const { data: allAgents } = await supabase
    .from('agents')
    .select('id, name, type')
    .order('name')

  // Build call_outcomes query with filters
  let outcomesQuery = supabase
    .from('call_outcomes')
    .select('*')
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59`)

  if (params.operator) {
    outcomesQuery = outcomesQuery.eq('user_id', params.operator)
  }

  const { data: outcomes } = await outcomesQuery

  // Build appointments query with filters
  let appointmentsQuery = supabase
    .from('appointments')
    .select('*, agents(name, type), users(name)')
    .gte('appointment_date', dateFrom)
    .lte('appointment_date', dateTo)
    .order('appointment_date')
    .order('appointment_time')

  if (params.operator) {
    appointmentsQuery = appointmentsQuery.eq('user_id', params.operator)
  }
  if (params.agent) {
    appointmentsQuery = appointmentsQuery.eq('agent_id', params.agent)
  }

  const { data: appointments } = await appointmentsQuery

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

  const operatorSummaries = Array.from(operatorMap.entries()).map(([id, data]) => ({
    user_id: id,
    ...data,
    total: data.non_risponde + data.negativo + data.appuntamento
  }))

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
    <div className="min-h-screen bg-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Suspense fallback={null}>
          <Filters operators={operators || []} agents={allAgents || []} />
        </Suspense>
        <SummaryCards counts={counts} />
        <AdminDashboard
          dailyData={dailyData}
          operatorSummaries={operatorSummaries}
          appointments={appointments || []}
          counts={counts}
        />
        <div className="flex justify-end">
          <a href="/admin/gestione"
            className="bg-white border rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
            Gestione Agenti e Operatrici &rarr;
          </a>
        </div>
      </main>
    </div>
  )
}
