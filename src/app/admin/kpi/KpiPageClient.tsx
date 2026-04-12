'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addCampaignEntry, deleteCampaignEntry } from './actions'
import type { OperatorKpi, KpiTotals, CampaignEntry } from './page'

function ProgressBar({ value, max, size = 'md' }: { value: number; max: number; size?: 'sm' | 'md' | 'lg' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const color = pct >= 80 ? 'from-emerald-400 to-emerald-500' : pct >= 50 ? 'from-amber-400 to-amber-500' : 'from-red-400 to-red-500'
  const bgColor = pct >= 80 ? 'bg-emerald-100' : pct >= 50 ? 'bg-amber-100' : 'bg-red-100'
  const h = size === 'lg' ? 'h-5' : size === 'md' ? 'h-3' : 'h-2'

  return (
    <div className={`w-full ${bgColor} rounded-full ${h} overflow-hidden`}>
      <div
        className={`${h} rounded-full bg-gradient-to-r ${color} transition-all duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function PctBadge({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const color = pct >= 80 ? 'text-emerald-700 bg-emerald-50' : pct >= 50 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {pct}%
    </span>
  )
}

const MONTH_NAMES = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

function generateMonthOptions(): { value: string; label: string }[] {
  const now = new Date()
  const options: { value: string; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
    options.push({ value, label })
  }
  return options
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export default function KpiPageClient({
  operators,
  operatorStats,
  totals,
  selectedMonth,
  selectedOperator,
}: {
  operators: { id: string; name: string }[]
  operatorStats: OperatorKpi[]
  totals: KpiTotals
  selectedMonth: string
  selectedOperator: string
}) {
  const router = useRouter()
  const monthOptions = generateMonthOptions()

  // Add nominativi form state
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [addCount, setAddCount] = useState('')
  const [addNote, setAddNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedEntries, setExpandedEntries] = useState<string | null>(null)

  function handleMonthChange(month: string) {
    const params = new URLSearchParams()
    params.set('month', month)
    if (selectedOperator) params.set('operator', selectedOperator)
    router.push(`/admin/kpi?${params.toString()}`)
  }

  function handleOperatorChange(opId: string) {
    const params = new URLSearchParams()
    params.set('month', selectedMonth)
    if (opId) params.set('operator', opId)
    router.push(`/admin/kpi?${params.toString()}`)
  }

  async function handleAddEntry(userId: string) {
    const count = parseInt(addCount)
    if (!count || count < 1) {
      setError('Inserisci un numero valido')
      return
    }
    setSaving(true)
    setError('')
    try {
      await addCampaignEntry({
        userId,
        month: selectedMonth,
        count,
        note: addNote || undefined,
      })
      setAddCount('')
      setAddNote('')
      setAddingFor(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm('Eliminare questa voce?')) return
    try {
      await deleteCampaignEntry(id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header + filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">KPI Campagna Hera</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatMonthLabel(selectedMonth)}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={e => handleMonthChange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
          >
            {monthOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={selectedOperator}
            onChange={e => handleOperatorChange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white min-w-[140px]"
          >
            <option value="">Tutte le operatrici</option>
            {operators.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Nominativi */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nominativi Campagna</span>
          </div>
          <span className="text-3xl font-bold text-gray-900">{totals.nominativi.toLocaleString('it-IT')}</span>
        </div>

        {/* Chiamate Salesforce */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chiamate Salesforce (15%)</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-gray-900">{totals.chiamateFatte.toLocaleString('it-IT')}</span>
            <span className="text-sm text-gray-400">/ {totals.targetChiamate.toLocaleString('it-IT')}</span>
            <PctBadge value={totals.chiamateFatte} max={totals.targetChiamate} />
          </div>
          <ProgressBar value={totals.chiamateFatte} max={totals.targetChiamate} size="lg" />
        </div>

        {/* Contratti */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contratti (3.5%)</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-gray-900">{totals.contrattiChiusi}</span>
            <span className="text-sm text-gray-400">/ {totals.targetContratti}</span>
            <PctBadge value={totals.contrattiChiusi} max={totals.targetContratti} />
          </div>
          <ProgressBar value={totals.contrattiChiusi} max={totals.targetContratti} size="lg" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Operator Breakdown Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Dettaglio per Operatrice</h2>
        </div>

        {operatorStats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">Nessuna operatrice trovata</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left bg-gray-50/50">
                  <th className="px-5 py-3 font-semibold text-gray-500">Operatrice</th>
                  <th className="px-5 py-3 font-semibold text-gray-500 text-right">Nominativi</th>
                  <th className="px-5 py-3 font-semibold text-gray-500">Chiamate (15%)</th>
                  <th className="px-5 py-3 font-semibold text-gray-500">Contratti (3.5%)</th>
                  <th className="px-3 py-3 font-semibold text-gray-500 text-center">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {operatorStats.map(op => (
                  <tr key={op.operatorId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors align-top">
                    {/* Operator name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-white">{op.operatorName.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-semibold text-gray-900">{op.operatorName}</span>
                      </div>
                    </td>

                    {/* Nominativi */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-lg font-bold text-gray-900">{op.nominativi.toLocaleString('it-IT')}</span>
                        {/* Entries toggle */}
                        {op.entries.length > 0 && (
                          <button
                            onClick={() => setExpandedEntries(expandedEntries === op.operatorId ? null : op.operatorId)}
                            className="text-[11px] text-gray-400 hover:text-blue-500 cursor-pointer transition-colors"
                          >
                            {op.entries.length} {op.entries.length === 1 ? 'voce' : 'voci'} {expandedEntries === op.operatorId ? '▲' : '▼'}
                          </button>
                        )}
                      </div>
                      {/* Expanded entries */}
                      {expandedEntries === op.operatorId && op.entries.length > 0 && (
                        <div className="mt-2 space-y-1 text-left">
                          {op.entries.map((entry: CampaignEntry) => (
                            <div key={entry.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 text-xs">
                              <div>
                                <span className="font-semibold text-gray-700">+{entry.count}</span>
                                {entry.note && <span className="text-gray-400 ml-1.5">— {entry.note}</span>}
                                <span className="text-gray-300 ml-1.5">
                                  {new Date(entry.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer p-0.5"
                                title="Elimina"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Chiamate progress */}
                    <td className="px-5 py-4">
                      {op.nominativi > 0 ? (
                        <div className="space-y-1.5 min-w-[160px]">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">{op.chiamateFatte} / {op.targetChiamate}</span>
                            <PctBadge value={op.chiamateFatte} max={op.targetChiamate} />
                          </div>
                          <ProgressBar value={op.chiamateFatte} max={op.targetChiamate} size="sm" />
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Contratti progress */}
                    <td className="px-5 py-4">
                      {op.nominativi > 0 ? (
                        <div className="space-y-1.5 min-w-[140px]">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">{op.contrattiChiusi} / {op.targetContratti}</span>
                            <PctBadge value={op.contrattiChiusi} max={op.targetContratti} />
                          </div>
                          <ProgressBar value={op.contrattiChiusi} max={op.targetContratti} size="sm" />
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-4 text-center">
                      {addingFor === op.operatorId ? (
                        <div className="flex flex-col items-start gap-2 min-w-[200px]">
                          <input
                            type="number"
                            min="1"
                            value={addCount}
                            onChange={e => setAddCount(e.target.value)}
                            placeholder="N. nominativi"
                            className="w-full px-2.5 py-1.5 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={addNote}
                            onChange={e => setAddNote(e.target.value)}
                            placeholder="Nota (opzionale)"
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none"
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleAddEntry(op.operatorId)}
                              disabled={saving}
                              className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {saving ? 'Salvo...' : 'Aggiungi'}
                            </button>
                            <button
                              onClick={() => { setAddingFor(null); setAddCount(''); setAddNote(''); setError('') }}
                              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Annulla
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingFor(op.operatorId); setError('') }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Aggiungi
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-full bg-gradient-to-r from-red-400 to-red-500"></div>
          <span>&lt; 50%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-500"></div>
          <span>50-80%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"></div>
          <span>&ge; 80%</span>
        </div>
      </div>
    </div>
  )
}
