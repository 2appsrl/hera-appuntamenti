'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateAppointmentAgent, deleteAppointment } from '../actions'
import { getRomeToday, getRomeFirstOfMonth } from '@/lib/dates'

const OUTCOME_LABELS: Record<string, { label: string; badge: string }> = {
  positivo: { label: 'Positivo', badge: 'bg-emerald-50 text-emerald-700' },
  negativo: { label: 'Negativo', badge: 'bg-red-50 text-red-700' },
  non_presentato: { label: 'Non presentato', badge: 'bg-gray-100 text-gray-600' },
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  const day = DAY_NAMES[date.getDay()]
  return `${day} ${d}-${m}-${y.slice(2)}`
}

interface AppointmentRow {
  id: string
  client_name: string
  client_surname: string
  client_phone: string
  appointment_date: string
  appointment_time: string
  location: string
  notes: string | null
  agents: { name: string; type: string } | null
  users: { name: string } | null
  appointment_outcomes: { outcome: string; notes: string | null } | null
}

interface AgentOption {
  id: string
  name: string
  type: string
  address?: string | null
}

interface OperatorOption {
  id: string
  name: string
}

export default function AppointmentsPageClient({
  appointments: initialAppointments,
  agents,
  operators,
  initialFrom,
  initialTo,
  initialAgent,
  initialOperator,
}: {
  appointments: AppointmentRow[]
  agents: AgentOption[]
  operators: OperatorOption[]
  initialFrom: string
  initialTo: string
  initialAgent: string
  initialOperator: string
}) {
  const router = useRouter()
  const [appointments, setAppointments] = useState(initialAppointments)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Sync appointments when server data changes (after client-side navigation)
  useEffect(() => {
    setAppointments(initialAppointments)
  }, [initialAppointments])
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Filter state
  const [dateFrom, setDateFrom] = useState(initialFrom)
  const [dateTo, setDateTo] = useState(initialTo)
  const [agentId, setAgentId] = useState(initialAgent)
  const [operatorId, setOperatorId] = useState(initialOperator)

  const today = getRomeToday()
  const firstOfMonth = getRomeFirstOfMonth()

  // Determine which quick filter is active based on server-resolved dates
  const activeQuick = initialFrom === '' && initialTo === '' ? 'tutti'
    : initialFrom === today && initialTo === today ? 'oggi'
    : initialFrom === firstOfMonth && initialTo === today ? 'mese'
    : null

  function navigateTo(from: string, to: string) {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    else params.set('from', '')
    if (to) params.set('to', to)
    else params.set('to', '')
    if (agentId) params.set('agent', agentId)
    if (operatorId) params.set('operator', operatorId)
    router.push(`/admin/appuntamenti?${params.toString()}`)
  }

  function quickToday() {
    setDateFrom(today)
    setDateTo(today)
    navigateTo(today, today)
  }

  function quickMonth() {
    setDateFrom(firstOfMonth)
    setDateTo(today)
    navigateTo(firstOfMonth, today)
  }

  function quickAll() {
    setDateFrom('')
    setDateTo('')
    navigateTo('', '')
  }

  function applyFilters() {
    const params = new URLSearchParams()
    // Always set from/to — empty means "show all"
    params.set('from', dateFrom)
    params.set('to', dateTo)
    if (agentId) params.set('agent', agentId)
    if (operatorId) params.set('operator', operatorId)
    router.push(`/admin/appuntamenti?${params.toString()}`)
  }

  function resetFilters() {
    setDateFrom('')
    setDateTo('')
    setAgentId('')
    setOperatorId('')
    router.push('/admin/appuntamenti')
  }

  async function handleAgentChange(appointmentId: string, newAgentId: string) {
    setSaving(appointmentId)
    try {
      await updateAppointmentAgent(appointmentId, newAgentId)
      const agent = agents.find(a => a.id === newAgentId)
      if (agent) {
        setAppointments(prev => prev.map(a =>
          a.id === appointmentId
            ? {
                ...a,
                agents: { name: agent.name, type: agent.type },
                location: agent.type === 'sportello' && agent.address ? agent.address : a.location,
              }
            : a
        ))
      }
      setEditingId(null)
    } catch {
      alert('Errore nel cambio agente')
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(appointmentId: string, clientName: string) {
    if (!confirm(`Eliminare l'appuntamento di ${clientName}?`)) return

    setDeleting(appointmentId)
    try {
      await deleteAppointment(appointmentId)
      setAppointments(prev => prev.filter(a => a.id !== appointmentId))
    } catch {
      alert('Errore nell\'eliminazione')
    } finally {
      setDeleting(null)
    }
  }

  function exportCSV() {
    const headers = ['Data', 'Giorno', 'Ora', 'Cliente', 'Telefono', 'Agente', 'Tipo', 'Luogo', 'Operatrice', 'Esito', 'Note']
    const rows = appointments.map(a => {
      const [y, m, d] = a.appointment_date.split('-')
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
      return [
        `${d}-${m}-${y.slice(2)}`,
        DAY_NAMES[date.getDay()],
        a.appointment_time?.slice(0, 5),
        `${a.client_name} ${a.client_surname}`,
        a.client_phone,
        a.agents?.name || '',
        a.agents?.type === 'agente' ? 'Agente' : 'Sportello',
        a.location,
        a.users?.name || '',
        a.appointment_outcomes ? (OUTCOME_LABELS[a.appointment_outcomes.outcome]?.label || '') : '',
        a.notes || '',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appuntamenti-${getRomeToday()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Calculate outcome summary
  const outcomeCounts = { positivo: 0, negativo: 0, non_presentato: 0, in_attesa: 0 }
  appointments.forEach(a => {
    const ao = a.appointment_outcomes
    if (ao && typeof ao === 'object' && 'outcome' in ao) {
      const outcome = ao.outcome as string
      if (outcome === 'positivo' || outcome === 'negativo' || outcome === 'non_presentato') {
        outcomeCounts[outcome]++
      }
    } else {
      outcomeCounts.in_attesa++
    }
  })
  const totalAppt = appointments.length
  const pctPositivi = totalAppt > 0 ? Math.round((outcomeCounts.positivo / totalAppt) * 100) : null
  const pctNegativi = totalAppt > 0 ? Math.round((outcomeCounts.negativo / totalAppt) * 100) : null
  const pctNonPres = totalAppt > 0 ? Math.round((outcomeCounts.non_presentato / totalAppt) * 100) : null
  const pctInAttesa = totalAppt > 0 ? Math.round((outcomeCounts.in_attesa / totalAppt) * 100) : null

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Appuntamenti</h1>
        <span className="text-sm text-gray-500">{appointments.length} risultati</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Filtri</span>
          <div className="flex gap-1.5 ml-auto">
            <button onClick={quickToday}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeQuick === 'oggi' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Oggi
            </button>
            <button onClick={quickMonth}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeQuick === 'mese' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Questo mese
            </button>
            <button onClick={quickAll}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeQuick === 'tutti' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Tutti
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Da</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">A</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Agente</label>
            <select
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[140px]"
            >
              <option value="">Tutti</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.type === 'agente' ? 'Ag.' : 'Sp.'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Operatrice</label>
            <select
              value={operatorId}
              onChange={e => setOperatorId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-[140px]"
            >
              <option value="">Tutte</option>
              {operators.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={applyFilters}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Filtra
            </button>
            {(dateFrom || dateTo || agentId || operatorId) && (
              <button
                onClick={resetFilters}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
          {appointments.length > 0 && (
            <button
              onClick={exportCSV}
              className="ml-auto flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Outcome summary cards */}
      {appointments.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold text-gray-500 uppercase">Positivi</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600">{outcomeCounts.positivo}</span>
              {pctPositivi !== null && <span className="text-sm font-medium text-emerald-500">{pctPositivi}%</span>}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span className="text-xs font-semibold text-gray-500 uppercase">Negativi</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-red-600">{outcomeCounts.negativo}</span>
              {pctNegativi !== null && <span className="text-sm font-medium text-red-400">{pctNegativi}%</span>}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-xs font-semibold text-gray-500 uppercase">Non pres.</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600">{outcomeCounts.non_presentato}</span>
              {pctNonPres !== null && <span className="text-sm font-medium text-amber-400">{pctNonPres}%</span>}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
              <span className="text-xs font-semibold text-gray-500 uppercase">In attesa</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-600">{outcomeCounts.in_attesa}</span>
              {pctInAttesa !== null && <span className="text-sm font-medium text-gray-400">{pctInAttesa}%</span>}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="text-xs font-semibold text-gray-500 uppercase">Totale</span>
            </div>
            <span className="text-2xl font-bold text-blue-700">{appointments.length}</span>
          </div>
        </div>
      )}

      {/* Appointments table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        {appointments.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400 text-sm">Nessun appuntamento trovato</p>
            {(dateFrom || dateTo || agentId || operatorId) && (
              <button onClick={resetFilters} className="mt-2 text-blue-500 hover:text-blue-700 text-sm font-medium cursor-pointer">
                Rimuovi filtri
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left bg-gray-50/50">
                <th className="px-5 py-3 font-semibold text-gray-500">Data</th>
                <th className="px-5 py-3 font-semibold text-gray-500">Ora</th>
                <th className="px-5 py-3 font-semibold text-gray-500">Cliente</th>
                <th className="px-5 py-3 font-semibold text-gray-500">Telefono</th>
                <th className="px-5 py-3 font-semibold text-gray-500">Agente</th>
                <th className="px-5 py-3 font-semibold text-gray-500">Luogo</th>
                <th className="px-5 py-3 font-semibold text-gray-500">Operatrice</th>
                <th className="px-5 py-3 font-semibold text-gray-500">Esito</th>
                <th className="px-5 py-3 font-semibold text-gray-500 min-w-[200px]">Note</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${deleting === a.id ? 'opacity-40' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{formatDate(a.appointment_date)}</td>
                  <td className="px-5 py-3">
                    <span className="bg-emerald-50 text-emerald-700 font-semibold text-xs px-2 py-1 rounded-lg">{a.appointment_time?.slice(0, 5)}</span>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{a.client_name} {a.client_surname}</td>
                  <td className="px-5 py-3 text-gray-600">{a.client_phone}</td>
                  <td className="px-5 py-3">
                    {editingId === a.id ? (
                      <select
                        autoFocus
                        defaultValue=""
                        disabled={saving === a.id}
                        onChange={(e) => {
                          if (e.target.value) handleAgentChange(a.id, e.target.value)
                        }}
                        onBlur={() => { if (saving !== a.id) setEditingId(null) }}
                        className="text-xs border border-blue-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[140px]"
                      >
                        <option value="" disabled>Seleziona agente...</option>
                        {agents.filter(ag => ag.name !== a.agents?.name).map(ag => (
                          <option key={ag.id} value={ag.id}>
                            {ag.name} ({ag.type === 'agente' ? 'Agente' : 'Sportello'})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingId(a.id)}
                        className="group/agent flex items-center gap-1 cursor-pointer"
                        title="Clicca per cambiare agente"
                      >
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full group-hover/agent:bg-blue-50 group-hover/agent:text-blue-600 transition-colors">
                          {a.agents?.name}
                        </span>
                        <svg className="w-3 h-3 text-gray-300 group-hover/agent:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{a.location}</td>
                  <td className="px-5 py-3 text-gray-600">{a.users?.name}</td>
                  <td className="px-5 py-3">
                    {a.appointment_outcomes ? (
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${OUTCOME_LABELS[a.appointment_outcomes.outcome]?.badge || 'bg-gray-100 text-gray-500'}`}>
                        {OUTCOME_LABELS[a.appointment_outcomes.outcome]?.label || a.appointment_outcomes.outcome}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs whitespace-pre-wrap break-words">{a.notes || '-'}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleDelete(a.id, `${a.client_name} ${a.client_surname}`)}
                      disabled={deleting === a.id}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                      title="Elimina appuntamento"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
