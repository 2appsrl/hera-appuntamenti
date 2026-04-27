'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRomeToday, getRomeFirstOfMonth } from '@/lib/dates'

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

interface OperatorBreakdown {
  userId: string
  name: string
  slots: {
    label: string
    non_risponde: number
    negativo: number
    appuntamento: number
    total: number
    pctAppuntamento: number
  }[]
}

export default function TimeSlotClient({
  slotData,
  operatorBreakdowns,
  operators,
  initialFrom,
  initialTo,
  initialOperator,
}: {
  slotData: SlotData[]
  operatorBreakdowns: OperatorBreakdown[]
  operators: { id: string; name: string }[]
  initialFrom: string
  initialTo: string
  initialOperator: string
}) {
  const router = useRouter()
  const [dateFrom, setDateFrom] = useState(initialFrom)
  const [dateTo, setDateTo] = useState(initialTo)
  const [operatorId, setOperatorId] = useState(initialOperator)

  const today = getRomeToday()
  const firstOfMonth = getRomeFirstOfMonth()

  function navigate(from: string, to: string, op?: string) {
    const params = new URLSearchParams()
    params.set('from', from)
    params.set('to', to)
    if ((op ?? operatorId)) params.set('operator', op ?? operatorId)
    router.push(`/admin/fasce-orarie?${params.toString()}`)
  }

  function applyFilters() {
    navigate(dateFrom, dateTo)
  }

  // Find the best and worst time slot
  const bestSlot = slotData.reduce<SlotData | null>((best, s) => {
    if (s.total < 5) return best // minimum sample
    if (!best || s.pctAppuntamento > best.pctAppuntamento) return s
    return best
  }, null)

  const worstSlot = slotData.reduce<SlotData | null>((worst, s) => {
    if (s.total < 5) return worst
    if (!worst || s.pctNonRisponde > worst.pctNonRisponde) return s
    return worst
  }, null)

  const maxTotal = Math.max(...slotData.map(s => s.total), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Analisi Fasce Orarie</h1>
        <a href="/admin" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          &larr; Dashboard
        </a>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Filtri</span>
          <div className="flex gap-1.5 ml-auto">
            <button onClick={() => { setDateFrom(today); setDateTo(today); navigate(today, today) }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${initialFrom === today && initialTo === today ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Oggi
            </button>
            <button onClick={() => { setDateFrom(firstOfMonth); setDateTo(today); navigate(firstOfMonth, today) }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${initialFrom === firstOfMonth && initialTo === today ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Questo mese
            </button>
            <button onClick={() => { setDateFrom(''); setDateTo(''); navigate('', '') }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${initialFrom === '' && initialTo === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Tutti
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Da</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">A</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Operatrice</label>
            <select value={operatorId} onChange={e => { setOperatorId(e.target.value); navigate(dateFrom, dateTo, e.target.value) }}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[140px]">
              <option value="">Tutte</option>
              {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <button onClick={applyFilters}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer">
            Filtra
          </button>
        </div>
      </div>

      {/* Insight cards */}
      {(bestSlot || worstSlot) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bestSlot && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">&#9650;</span>
                <span className="text-sm font-semibold text-emerald-800 uppercase">Miglior fascia</span>
              </div>
              <div className="text-3xl font-bold text-emerald-700">{bestSlot.label}</div>
              <p className="text-sm text-emerald-600 mt-1">
                {bestSlot.pctAppuntamento}% appuntamenti su {bestSlot.total} chiamate
              </p>
            </div>
          )}
          {worstSlot && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">&#9660;</span>
                <span className="text-sm font-semibold text-orange-800 uppercase">Peggiore fascia</span>
              </div>
              <div className="text-3xl font-bold text-orange-700">{worstSlot.label}</div>
              <p className="text-sm text-orange-600 mt-1">
                {worstSlot.pctNonRisponde}% non risponde su {worstSlot.total} chiamate
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main chart - stacked horizontal bars */}
      {slotData.length > 0 ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">Esiti per fascia oraria</h2>
          <div className="space-y-3">
            {slotData.map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-sm font-mono font-semibold text-gray-600 w-14 text-right">{s.label}</span>
                <div className="flex-1 flex items-center gap-1">
                  {/* Stacked bar */}
                  <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden flex">
                    {s.pctAppuntamento > 0 && (
                      <div
                        className="bg-emerald-500 h-full flex items-center justify-center"
                        style={{ width: `${s.pctAppuntamento}%` }}
                        title={`Appuntamenti: ${s.appuntamento} (${s.pctAppuntamento}%)`}
                      >
                        {s.pctAppuntamento >= 8 && (
                          <span className="text-[10px] font-bold text-white">{s.pctAppuntamento}%</span>
                        )}
                      </div>
                    )}
                    {s.pctNegativo > 0 && (
                      <div
                        className="bg-red-400 h-full flex items-center justify-center"
                        style={{ width: `${s.pctNegativo}%` }}
                        title={`Negativi: ${s.negativo} (${s.pctNegativo}%)`}
                      >
                        {s.pctNegativo >= 8 && (
                          <span className="text-[10px] font-bold text-white">{s.pctNegativo}%</span>
                        )}
                      </div>
                    )}
                    {s.pctNonRisponde > 0 && (
                      <div
                        className="bg-orange-400 h-full flex items-center justify-center"
                        style={{ width: `${s.pctNonRisponde}%` }}
                        title={`Non risponde: ${s.non_risponde} (${s.pctNonRisponde}%)`}
                      >
                        {s.pctNonRisponde >= 8 && (
                          <span className="text-[10px] font-bold text-white">{s.pctNonRisponde}%</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 w-10 text-right">{s.total}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-5 mt-5 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500"></span>
              <span className="text-xs text-gray-500">Appuntamento</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-400"></span>
              <span className="text-xs text-gray-500">Negativo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-orange-400"></span>
              <span className="text-xs text-gray-500">Non risponde</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-400 text-sm">Nessun dato per il periodo selezionato</p>
        </div>
      )}

      {/* Detail table */}
      {slotData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Fascia</th>
                <th className="px-5 py-3 text-right font-semibold text-gray-500">Totale</th>
                <th className="px-5 py-3 text-right font-semibold text-emerald-600">Appuntam.</th>
                <th className="px-5 py-3 text-right font-semibold text-emerald-600">%</th>
                <th className="px-5 py-3 text-right font-semibold text-red-500">Negativi</th>
                <th className="px-5 py-3 text-right font-semibold text-red-500">%</th>
                <th className="px-5 py-3 text-right font-semibold text-orange-500">Non risp.</th>
                <th className="px-5 py-3 text-right font-semibold text-orange-500">%</th>
              </tr>
            </thead>
            <tbody>
              {slotData.map(s => (
                <tr key={s.label} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono font-semibold text-gray-700">{s.label}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{s.total}</td>
                  <td className="px-5 py-3 text-right font-medium text-emerald-600">{s.appuntamento}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.pctAppuntamento >= 3 ? 'bg-emerald-50 text-emerald-700' : 'text-gray-400'}`}>
                      {s.pctAppuntamento}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-red-500">{s.negativo}</td>
                  <td className="px-5 py-3 text-right text-xs text-gray-500">{s.pctNegativo}%</td>
                  <td className="px-5 py-3 text-right font-medium text-orange-500">{s.non_risponde}</td>
                  <td className="px-5 py-3 text-right text-xs text-gray-500">{s.pctNonRisponde}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-operator breakdown */}
      {operatorBreakdowns.length > 1 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Dettaglio per operatrice</h2>
          {operatorBreakdowns.map(ob => (
            <div key={ob.userId} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-3">{ob.name}</h3>
              <div className="space-y-2">
                {ob.slots.map(s => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-500 w-12 text-right">{s.label}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden flex">
                      {s.pctAppuntamento > 0 && (
                        <div className="bg-emerald-500 h-full" style={{ width: `${s.pctAppuntamento}%` }}></div>
                      )}
                      {s.negativo > 0 && (
                        <div className="bg-red-400 h-full" style={{ width: `${Math.round((s.negativo / s.total) * 100)}%` }}></div>
                      )}
                      {s.non_risponde > 0 && (
                        <div className="bg-orange-400 h-full" style={{ width: `${Math.round((s.non_risponde / s.total) * 100)}%` }}></div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{s.total}</span>
                    <span className="text-xs font-semibold text-emerald-600 w-10 text-right">{s.pctAppuntamento}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
