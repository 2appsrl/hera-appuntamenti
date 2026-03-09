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
    <div className="bg-white rounded-lg p-4 shadow-sm border space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Da</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">A</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Operatrice</label>
          <select value={operatorId} onChange={e => setOperatorId(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="">Tutte</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Agente/Sportello</label>
          <select value={agentId} onChange={e => setAgentId(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="">Tutti</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={applyFilters}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 cursor-pointer">
          Applica
        </button>
        <button onClick={resetFilters}
          className="text-gray-600 px-4 py-1.5 rounded text-sm hover:bg-gray-100 cursor-pointer">
          Reset
        </button>
      </div>
    </div>
  )
}
