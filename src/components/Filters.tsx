'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type { User, Agent } from '@/lib/types'

export default function Filters({
  operators,
  agents,
}: {
  operators: Pick<User, 'id' | 'name'>[]
  agents: Pick<Agent, 'id' | 'name' | 'type'>[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '')
  const [operatorId, setOperatorId] = useState(searchParams.get('operator') || '')
  const [agentId, setAgentId] = useState(searchParams.get('agent') || '')

  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'

  // Determine which quick filter is active based on URL params
  const urlFrom = searchParams.get('from')
  const urlTo = searchParams.get('to')
  const activeQuick = urlFrom === '' ? 'tutti' // explicitly empty = show all
    : urlFrom === null && urlTo === null ? 'oggi' // no params = default today
    : urlFrom === today && urlTo === today ? 'oggi'
    : urlFrom === firstOfMonth && urlTo === today ? 'mese'
    : null

  function navigate(from: string, to: string) {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (operatorId) params.set('operator', operatorId)
    if (agentId) params.set('agent', agentId)
    router.push(`/admin?${params.toString()}`)
  }

  function quickToday() {
    setDateFrom(today)
    setDateTo(today)
    navigate(today, today)
  }

  function quickMonth() {
    setDateFrom(firstOfMonth)
    setDateTo(today)
    navigate(firstOfMonth, today)
  }

  function quickAll() {
    setDateFrom('')
    setDateTo('')
    const params = new URLSearchParams()
    params.set('from', '')
    params.set('to', '')
    if (operatorId) params.set('operator', operatorId)
    if (agentId) params.set('agent', agentId)
    router.push(`/admin?${params.toString()}`)
  }

  function applyFilters() {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    if (operatorId) params.set('operator', operatorId)
    if (agentId) params.set('agent', agentId)
    router.push(`/admin?${params.toString()}`)
  }

  function resetFilters() {
    setDateFrom('')
    setDateTo('')
    setOperatorId('')
    setAgentId('')
    router.push('/admin')
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
      <div className="flex items-center gap-2 mb-1">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Da</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">A</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Operatrice</label>
          <select value={operatorId} onChange={e => setOperatorId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all">
            <option value="">Tutte</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Agente/Sportello</label>
          <select value={agentId} onChange={e => setAgentId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all">
            <option value="">Tutti</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={applyFilters}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-2 rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all cursor-pointer">
          Applica filtri
        </button>
        <button onClick={resetFilters}
          className="text-gray-500 px-4 py-2 rounded-xl text-sm hover:bg-gray-100 transition-colors cursor-pointer">
          Reset
        </button>
      </div>
    </div>
  )
}
