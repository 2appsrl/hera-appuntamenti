'use client'

import { useState } from 'react'
import { generateInvitiPdf } from './actions'

interface AgentRow {
  id: string
  name: string
}

interface Sportello {
  id: string
  name: string
  address: string | null
  phone: string | null
}

interface RowState {
  agentId: string
  selected: boolean
  sportelloId: string
}

export default function InvitiPageClient({
  agents,
  sportelli,
}: {
  agents: AgentRow[]
  sportelli: Sportello[]
}) {
  const [rows, setRows] = useState<RowState[]>(() =>
    agents.map(a => ({ agentId: a.id, selected: false, sportelloId: '' }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allSelected = rows.length > 0 && rows.every(r => r.selected)
  const anySelected = rows.some(r => r.selected)

  function toggleAll() {
    const next = !allSelected
    setRows(rs => rs.map(r => ({ ...r, selected: next })))
  }

  function setRow(agentId: string, patch: Partial<RowState>) {
    setRows(rs => rs.map(r => (r.agentId === agentId ? { ...r, ...patch } : r)))
  }

  async function handleGenerate() {
    setError(null)
    const selected = rows.filter(r => r.selected)
    if (selected.length === 0) { setError('Seleziona almeno un agente'); return }
    const missing = selected.find(r => !r.sportelloId)
    if (missing) {
      const ag = agents.find(a => a.id === missing.agentId)
      setError(`Scegli lo sportello per ${ag?.name || 'l\'agente selezionato'}`)
      return
    }

    setLoading(true)
    try {
      const result = await generateInvitiPdf(
        selected.map(r => ({ agentId: r.agentId, sportelloId: r.sportelloId }))
      )
      if ('error' in result) {
        setError(result.error)
        return
      }
      const bytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inviti-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore inatteso')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Biglietti invito</h1>
          <p className="text-sm text-gray-500 mt-1">
            Genera un PDF stampabile con i biglietti per agenzie immobiliari e amministratori di condominio.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAll}
            disabled={rows.length === 0}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !anySelected}
            className="bg-rose-600 hover:bg-rose-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm shadow-sm transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {loading ? 'Generazione...' : 'Genera PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {agents.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            Nessun agente attivo.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left bg-gray-50/50">
                <th className="px-5 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-rose-500 cursor-pointer" />
                </th>
                <th className="px-5 py-3 font-semibold text-gray-500">Agente</th>
                <th className="px-5 py-3 font-semibold text-gray-500">Sportello di riferimento</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => {
                const row = rows.find(r => r.agentId === a.id)!
                return (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={e => setRow(a.id, { selected: e.target.checked })}
                        className="accent-rose-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-5 py-3">
                      <select
                        value={row.sportelloId}
                        onChange={e => setRow(a.id, { sportelloId: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent min-w-[220px]"
                      >
                        <option value="">— scegli sportello —</option>
                        {sportelli.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
