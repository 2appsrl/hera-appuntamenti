import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/Header'
import KpiPageClient from './KpiPageClient'
import { getRomeToday, romeRangeUTC } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export interface CampaignEntry {
  id: string
  user_id: string
  month: string
  count: number
  note: string | null
  created_at: string
}

export interface CampaignEntryEnriched extends CampaignEntry {
  callCount: number
  target: number
}

export interface OperatorKpi {
  operatorId: string
  operatorName: string
  nominativi: number
  targetChiamate: number
  targetContratti: number
  chiamateFatte: number
  contrattiChiusi: number
  appuntamentiFissati: number
  entries: CampaignEntryEnriched[]
}

export interface KpiTotals {
  nominativi: number
  targetChiamate: number
  targetContratti: number
  chiamateFatte: number
  contrattiChiusi: number
  appuntamentiFissati: number
}

export default async function KpiPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; operator?: string }>
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

  const today = getRomeToday()
  const currentMonth = today.slice(0, 7)
  const selectedMonth = params.month || currentMonth
  const firstOfMonth = `${selectedMonth}-01`
  const [y, m] = selectedMonth.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const lastOfMonth = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`
  const monthRange = romeRangeUTC(firstOfMonth, lastOfMonth)

  const admin = createAdminClient()

  let apptQuery = admin
    .from('appointments')
    .select('user_id, appointment_outcomes!inner(outcome)')
    .gte('appointment_date', firstOfMonth)
    .lte('appointment_date', lastOfMonth)

  if (params.operator) {
    apptQuery = apptQuery.eq('user_id', params.operator)
  }

  let callQuery = admin
    .from('call_outcomes')
    .select('user_id, created_at')
    .gte('created_at', monthRange.fromUTC)
    .lte('created_at', monthRange.toUTC)
    .order('created_at', { ascending: true })
    .range(0, 49999)

  if (params.operator) {
    callQuery = callQuery.eq('user_id', params.operator)
  }

  const [
    { data: operators },
    { data: campaignEntries },
    { data: appointmentData },
    { data: callOutcomes },
  ] = await Promise.all([
    admin.from('users').select('id, name').eq('role', 'operatore').order('name'),
    admin.from('campaign_entries').select('*').eq('month', selectedMonth),
    apptQuery,
    callQuery,
  ])

  // Determine which operators to include
  const operatorList = params.operator
    ? (operators || []).filter(o => o.id === params.operator)
    : (operators || [])

  // Per-operator chiamate + appuntamenti via SQL COUNT (avoids the 1000-row
  // default limit that silently truncates large months).
  const perOperatorCounts = await Promise.all(
    operatorList.map(async op => {
      const [{ count: callCount }, { count: apptCount }] = await Promise.all([
        admin
          .from('call_outcomes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', op.id)
          .gte('created_at', monthRange.fromUTC)
          .lte('created_at', monthRange.toUTC),
        admin
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', op.id)
          .gte('appointment_date', firstOfMonth)
          .lte('appointment_date', lastOfMonth),
      ])
      return [op.id, { calls: callCount ?? 0, appts: apptCount ?? 0 }] as const
    })
  )
  const countMap = new Map<string, { calls: number; appts: number }>(perOperatorCounts)

  const operatorStats: OperatorKpi[] = operatorList.map(({ id: opId, name }) => {
    const nominativi = (campaignEntries || [])
      .filter((e: CampaignEntry) => e.user_id === opId)
      .reduce((sum: number, e: CampaignEntry) => sum + e.count, 0)
    const targetChiamate = Math.ceil(nominativi * 0.15)
    const targetContratti = Math.ceil(targetChiamate * 0.035)
    const counts = countMap.get(opId)
    const chiamateFatte = counts?.calls ?? 0
    const appuntamentiFissati = counts?.appts ?? 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contrattiChiusi = (appointmentData || []).filter((a: any) => {
      if (a.user_id !== opId) return false
      const outcome = Array.isArray(a.appointment_outcomes)
        ? a.appointment_outcomes[0]
        : a.appointment_outcomes
      return outcome?.outcome === 'positivo'
    }).length

    const operatorEntries = ((campaignEntries || []) as CampaignEntry[])
      .filter(e => e.user_id === opId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const opCallOutcomes = (callOutcomes || []).filter(
      (c: { user_id: string; created_at: string }) => c.user_id === opId
    )

    const entries: CampaignEntryEnriched[] = operatorEntries.map((entry, i) => {
      const nextEntry = operatorEntries[i + 1]
      const intervalEndIso = nextEntry ? nextEntry.created_at : monthRange.toUTC
      // Half-open interval [entry.created_at, intervalEndIso): a call recorded
      // at the exact instant a new voce is created counts toward the new voce.
      const callCount = opCallOutcomes.filter(c =>
        c.created_at >= entry.created_at && c.created_at < intervalEndIso
      ).length
      return {
        ...entry,
        callCount,
        target: Math.ceil(entry.count * 0.15),
      }
    })

    return {
      operatorId: opId,
      operatorName: name,
      nominativi,
      targetChiamate,
      targetContratti,
      chiamateFatte,
      contrattiChiusi,
      appuntamentiFissati,
      entries,
    }
  })

  const totals: KpiTotals = {
    nominativi: operatorStats.reduce((s, o) => s + o.nominativi, 0),
    targetChiamate: operatorStats.reduce((s, o) => s + o.targetChiamate, 0),
    targetContratti: operatorStats.reduce((s, o) => s + o.targetContratti, 0),
    chiamateFatte: operatorStats.reduce((s, o) => s + o.chiamateFatte, 0),
    contrattiChiusi: operatorStats.reduce((s, o) => s + o.contrattiChiusi, 0),
    appuntamentiFissati: operatorStats.reduce((s, o) => s + o.appuntamentiFissati, 0),
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <KpiPageClient
          operators={operators || []}
          operatorStats={operatorStats}
          totals={totals}
          selectedMonth={selectedMonth}
          selectedOperator={params.operator || ''}
        />
      </main>
    </div>
  )
}
