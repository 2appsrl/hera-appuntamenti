'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DailyCounter from '@/components/DailyCounter'
import OutcomeButtons from '@/components/OutcomeButtons'
import AppointmentModal from '@/components/AppointmentModal'
import { startCallSession, stopCallSession } from './actions'
import type { Agent, AgentAvailability, AppointmentWithAgent, AppointmentWithAgentAndOutcome, OutcomeSummary } from '@/lib/types'

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = Math.floor(totalMinutes % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function OperatorPageClient({
  agents,
  availability,
  todayAppointments,
  allAppointments,
  initialCounts,
  activeSessionStartedAt,
  todayMinutesWorked,
}: {
  agents: Pick<Agent, 'id' | 'name' | 'type' | 'address'>[]
  availability: AgentAvailability[]
  todayAppointments: AppointmentWithAgent[]
  allAppointments: AppointmentWithAgentAndOutcome[]
  initialCounts: OutcomeSummary
  activeSessionStartedAt: string | null
  todayMinutesWorked: number
}) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [isActive, setIsActive] = useState(!!activeSessionStartedAt)
  const [sessionStart, setSessionStart] = useState<Date | null>(
    activeSessionStartedAt ? new Date(activeSessionStartedAt) : null
  )
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)

  // Optimistic counts — update instantly on click, sync with server on revalidation
  const [counts, setCounts] = useState<OutcomeSummary>(initialCounts)
  // Keep in sync when server revalidates (e.g. after navigation)
  useEffect(() => {
    setCounts(initialCounts)
  }, [initialCounts])

  // Called by OutcomeButtons for instant UI update
  function handleOptimisticOutcome(outcome: keyof OutcomeSummary) {
    setCounts(prev => ({ ...prev, [outcome]: prev[outcome] + 1 }))
  }

  // Timer for active session
  useEffect(() => {
    if (!isActive || !sessionStart) return
    const tick = () => {
      setElapsed(Math.floor((Date.now() - sessionStart.getTime()) / 1000))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isActive, sessionStart])

  async function handleStart() {
    setLoading(true)
    try {
      await startCallSession()
      setIsActive(true)
      setSessionStart(new Date())
      setElapsed(0)
    } catch {
      alert('Errore nell\'avvio sessione')
    } finally {
      setLoading(false)
    }
  }

  async function handleStop() {
    setLoading(true)
    try {
      await stopCallSession()
      setIsActive(false)
      setSessionStart(null)
      setElapsed(0)
    } catch {
      alert('Errore nella chiusura sessione')
    } finally {
      setLoading(false)
    }
  }

  const elapsedH = Math.floor(elapsed / 3600)
  const elapsedM = Math.floor((elapsed % 3600) / 60)
  const elapsedS = elapsed % 60

  // --- Appuntamenti Fissati state ---
  const [activeTab, setActiveTab] = useState<'prossimi' | 'passati'>('prossimi')
  const [showFilters, setShowFilters] = useState(false)
  const [filterAgent, setFilterAgent] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterOutcome, setFilterOutcome] = useState('')
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithAgentAndOutcome | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const filteredAppointments = useMemo(() => {
    let list = allAppointments.filter(a =>
      activeTab === 'prossimi' ? a.appointment_date >= today : a.appointment_date < today
    )

    if (filterAgent) {
      list = list.filter(a => a.agent_id === filterAgent)
    }
    if (filterDateFrom) {
      list = list.filter(a => a.appointment_date >= filterDateFrom)
    }
    if (filterDateTo) {
      list = list.filter(a => a.appointment_date <= filterDateTo)
    }
    if (filterOutcome) {
      if (filterOutcome === 'in_attesa') {
        list = list.filter(a => !a.appointment_outcomes)
      } else {
        list = list.filter(a => a.appointment_outcomes?.outcome === filterOutcome)
      }
    }

    list.sort((a, b) => {
      const dateCompare = a.appointment_date.localeCompare(b.appointment_date)
      if (dateCompare !== 0) return activeTab === 'prossimi' ? dateCompare : -dateCompare
      const timeCompare = a.appointment_time.localeCompare(b.appointment_time)
      return activeTab === 'prossimi' ? timeCompare : -timeCompare
    })

    return list
  }, [allAppointments, activeTab, today, filterAgent, filterDateFrom, filterDateTo, filterOutcome])

  function outcomeBadge(apt: AppointmentWithAgentAndOutcome) {
    const o = apt.appointment_outcomes
    if (!o) return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">In attesa</span>
    const styles = {
      positivo: 'bg-emerald-100 text-emerald-700',
      negativo: 'bg-red-100 text-red-700',
      non_presentato: 'bg-gray-200 text-gray-600',
    }
    const labels = { positivo: 'Positivo', negativo: 'Negativo', non_presentato: 'Non presentato' }
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[o.outcome]}`}>{labels[o.outcome]}</span>
  }

  return (
    <>
      {/* Optimistic daily counter */}
      <DailyCounter counts={counts} />

      {/* Call session tracker */}
      <div className={`rounded-2xl p-4 shadow-sm border transition-colors ${isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-500' : 'bg-gray-200'}`}>
              <svg className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              {isActive ? (
                <>
                  <div className="text-sm font-semibold text-emerald-700">Chiamate in corso</div>
                  <div className="text-2xl font-bold text-emerald-800 tabular-nums">
                    {String(elapsedH).padStart(2, '0')}:{String(elapsedM).padStart(2, '0')}:{String(elapsedS).padStart(2, '0')}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-gray-500">Sessione chiamate</div>
                  <div className="text-xs text-gray-400">
                    Oggi: {formatMinutes(todayMinutesWorked + elapsed / 60)}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isActive && (
              <div className="flex items-center gap-1.5 mr-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-medium">Attiva</span>
              </div>
            )}
            {!isActive ? (
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Inizio Chiamate
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                Fine Chiamate
              </button>
            )}
          </div>
        </div>
        {todayMinutesWorked > 0 && isActive && (
          <div className="mt-2 text-xs text-emerald-600">
            Totale oggi: {formatMinutes(todayMinutesWorked + elapsed / 60)}
          </div>
        )}
      </div>

      <OutcomeButtons
        onAppointmentClick={() => setShowModal(true)}
        onOptimisticUpdate={handleOptimisticOutcome}
      />

      {showModal && (
        <AppointmentModal
          agents={agents}
          availability={availability}
          onClose={() => {
            setShowModal(false)
            router.refresh()
          }}
          onCreated={() => handleOptimisticOutcome('appuntamento')}
        />
      )}

      {/* Appuntamenti Fissati */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Appuntamenti Fissati
          </h2>
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            {allAppointments.length}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
          <button
            onClick={() => setActiveTab('prossimi')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'prossimi' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            Prossimi
          </button>
          <button
            onClick={() => setActiveTab('passati')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'passati' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            Passati
          </button>
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2 cursor-pointer"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Filtri
        </button>

        {/* Filters panel */}
        {showFilters && (
          <div className="bg-white rounded-xl p-3 border border-gray-100 mb-3 space-y-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Agente</label>
              <select
                value={filterAgent}
                onChange={e => setFilterAgent(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Tutti</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Da</label>
                <input
                  type="date" value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">A</label>
                <input
                  type="date" value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Esito</label>
              <select
                value={filterOutcome}
                onChange={e => setFilterOutcome(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Tutti</option>
                <option value="in_attesa">In attesa</option>
                <option value="positivo">Positivo</option>
                <option value="negativo">Negativo</option>
                <option value="non_presentato">Non presentato</option>
              </select>
            </div>
            {(filterAgent || filterDateFrom || filterDateTo || filterOutcome) && (
              <button
                onClick={() => { setFilterAgent(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterOutcome('') }}
                className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
              >
                Resetta filtri
              </button>
            )}
          </div>
        )}

        {/* Appointment list */}
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-sm">Nessun appuntamento</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAppointments.map((apt) => (
              <div key={apt.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="bg-emerald-50 text-emerald-700 font-bold text-xs px-2.5 py-1.5 rounded-lg text-center shrink-0">
                      <div>{apt.appointment_time.slice(0, 5)}</div>
                      <div className="text-[10px] font-medium text-emerald-500">
                        {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{apt.client_name} {apt.client_surname}</div>
                      <div className="text-xs text-gray-400 truncate">{apt.client_phone}</div>
                      {apt.location && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{apt.location}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{apt.agents?.name}</span>
                        {outcomeBadge(apt)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingAppointment(apt)}
                    className="text-gray-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors shrink-0 cursor-pointer"
                    title="Modifica"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingAppointment && (
        <AppointmentModal
          agents={agents}
          availability={availability}
          onClose={() => {
            setEditingAppointment(null)
            router.refresh()
          }}
          editData={{
            id: editingAppointment.id,
            clientName: editingAppointment.client_name,
            clientSurname: editingAppointment.client_surname,
            clientPhone: editingAppointment.client_phone,
            agentId: editingAppointment.agent_id,
            appointmentDate: editingAppointment.appointment_date,
            appointmentTime: editingAppointment.appointment_time,
            location: editingAppointment.location,
            notes: editingAppointment.notes || '',
          }}
        />
      )}
    </>
  )
}
