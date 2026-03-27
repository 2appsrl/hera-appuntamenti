import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/Header'
import TimeSlotClient from './TimeSlotClient'

export const dynamic = 'force-dynamic'

// Time slots: 8-9, 9-10, 10-11, 11-12, 12-13, 14-15, 15-16, 16-17, 17-18, 18-19, 19-20
const TIME_SLOTS = [
  { label: '08-09', start: 8, end: 9 },
  { label: '09-10', start: 9, end: 10 },
  { label: '10-11', start: 10, end: 11 },
  { label: '11-12', start: 11, end: 12 },
  { label: '12-13', start: 12, end: 13 },
  { label: '14-15', start: 14, end: 15 },
  { label: '15-16', start: 15, end: 16 },
  { label: '16-17', start: 16, end: 17 },
  { label: '17-18', start: 17, end: 18 },
  { label: '18-19', start: 18, end: 19 },
  { label: '19-20', start: 19, end: 20 },
]

interface SlotData {
  label: string
  non_risponde: number
  negativo: number
  appuntamento: number
  total: number
  pctNonRisponde: number
  pctNegativo: number
  pctAppuntamento: number
}

export default async function FasceOrariePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; operator?: string }>
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

  const today = new Date().toISOString().split('T')[0]
  const showAll = 'from' in params && params.from === ''
  const dateFrom = showAll ? '' : (params.from || today.slice(0, 8) + '01')
  const dateTo = showAll ? '' : (params.to || today)

  const admin = createAdminClient()

  // Fetch operators
  const { data: operators } = await admin
    .from('users')
    .select('id, name')
    .eq('role', 'operatore')
    .order('name')

  // Fetch outcomes with timestamp
  let q = admin
    .from('call_outcomes')
    .select('outcome, created_at, user_id')

  if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`)
  if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59`)
  if (params.operator) q = q.eq('user_id', params.operator)

  const { data: outcomes } = await q

  // Group by time slot
  const slotDataMap = new Map<string, { non_risponde: number; negativo: number; appuntamento: number }>()
  TIME_SLOTS.forEach(s => slotDataMap.set(s.label, { non_risponde: 0, negativo: 0, appuntamento: 0 }))

  outcomes?.forEach(o => {
    const hour = new Date(o.created_at).getHours()
    const slot = TIME_SLOTS.find(s => hour >= s.start && hour < s.end)
    if (slot) {
      const data = slotDataMap.get(slot.label)!
      if (o.outcome === 'non_risponde') data.non_risponde++
      else if (o.outcome === 'negativo') data.negativo++
      else if (o.outcome === 'appuntamento') data.appuntamento++
    }
  })

  const slotData: SlotData[] = TIME_SLOTS.map(s => {
    const d = slotDataMap.get(s.label)!
    const total = d.non_risponde + d.negativo + d.appuntamento
    return {
      label: s.label,
      ...d,
      total,
      pctNonRisponde: total > 0 ? Math.round((d.non_risponde / total) * 100) : 0,
      pctNegativo: total > 0 ? Math.round((d.negativo / total) * 100) : 0,
      pctAppuntamento: total > 0 ? Math.round((d.appuntamento / total) * 100) : 0,
    }
  }).filter(s => s.total > 0)

  // Per-operator breakdown
  const operatorSlotMap = new Map<string, Map<string, { non_risponde: number; negativo: number; appuntamento: number }>>()
  outcomes?.forEach(o => {
    const hour = new Date(o.created_at).getHours()
    const slot = TIME_SLOTS.find(s => hour >= s.start && hour < s.end)
    if (!slot) return

    if (!operatorSlotMap.has(o.user_id)) {
      const map = new Map<string, { non_risponde: number; negativo: number; appuntamento: number }>()
      TIME_SLOTS.forEach(s => map.set(s.label, { non_risponde: 0, negativo: 0, appuntamento: 0 }))
      operatorSlotMap.set(o.user_id, map)
    }
    const data = operatorSlotMap.get(o.user_id)!.get(slot.label)!
    if (o.outcome === 'non_risponde') data.non_risponde++
    else if (o.outcome === 'negativo') data.negativo++
    else if (o.outcome === 'appuntamento') data.appuntamento++
  })

  const operatorBreakdowns = Array.from(operatorSlotMap.entries()).map(([userId, slotsMap]) => {
    const opName = operators?.find(op => op.id === userId)?.name || 'Sconosciuto'
    const slots = TIME_SLOTS.map(s => {
      const d = slotsMap.get(s.label)!
      const total = d.non_risponde + d.negativo + d.appuntamento
      return {
        label: s.label,
        ...d,
        total,
        pctAppuntamento: total > 0 ? Math.round((d.appuntamento / total) * 100) : 0,
      }
    }).filter(s => s.total > 0)
    return { userId, name: opName, slots }
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <TimeSlotClient
          slotData={slotData}
          operatorBreakdowns={operatorBreakdowns}
          operators={operators || []}
          initialFrom={dateFrom}
          initialTo={dateTo}
          initialOperator={params.operator || ''}
        />
      </main>
    </div>
  )
}
