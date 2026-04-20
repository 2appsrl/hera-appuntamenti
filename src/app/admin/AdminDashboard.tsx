'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { useState } from 'react'
import { NEGATIVE_REASON_LABELS, NEGATIVE_REASON_ORDER } from '@/lib/types'
import type { OutcomeSummary, DailyOutcomeSummary, OperatorSummary, NegativeBreakdown, NegativeNoteEntry } from '@/lib/types'

const COLORS = { non_risponde: '#f97316', negativo: '#ef4444', appuntamento: '#22c55e' }

export default function AdminDashboard({
  dailyData,
  operatorSummaries,
  counts,
  negativeBreakdown,
  negativeNotes,
}: {
  dailyData: DailyOutcomeSummary[]
  operatorSummaries: OperatorSummary[]
  counts: OutcomeSummary
  negativeBreakdown: NegativeBreakdown
  negativeNotes: NegativeNoteEntry[]
}) {
  const total = counts.non_risponde + counts.negativo + counts.appuntamento
  const pieData = [
    { name: 'Non risponde', value: counts.non_risponde, color: COLORS.non_risponde },
    { name: 'Negativi', value: counts.negativo, color: COLORS.negativo },
    { name: 'Appuntamenti', value: counts.appuntamento, color: COLORS.appuntamento },
  ].filter(d => d.value > 0)

  const totalNegativi = counts.negativo
  const breakdownRows = [
    ...NEGATIVE_REASON_ORDER.map(r => ({
      key: r as string,
      label: NEGATIVE_REASON_LABELS[r],
      count: negativeBreakdown[r] || 0,
    })),
    ...((negativeBreakdown.nd || 0) > 0
      ? [{ key: 'nd', label: 'N.D. (storici)', count: negativeBreakdown.nd || 0 }]
      : []),
  ]
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)

  const maxBreakdown = breakdownRows[0]?.count || 1
  const [showAllNotes, setShowAllNotes] = useState(false)
  const visibleNotes = showAllNotes ? negativeNotes : negativeNotes.slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Charts */}
      {dailyData.length > 1 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">Andamento giornaliero</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
              <Legend />
              <Line type="monotone" dataKey="non_risponde" name="Non risponde" stroke={COLORS.non_risponde} strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="negativo" name="Negativi" stroke={COLORS.negativo} strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="appuntamento" name="Appuntamenti" stroke={COLORS.appuntamento} strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {totalNegativi > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Dettaglio negativi</h3>
            <span className="text-xs text-gray-400">
              {totalNegativi} totali
              {(negativeBreakdown.nd || 0) > 0 && ` · ${negativeBreakdown.nd} N.D.`}
            </span>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            {breakdownRows.map(row => {
              const pct = totalNegativi > 0 ? Math.round((row.count / totalNegativi) * 100) : 0
              const widthPct = (row.count / maxBreakdown) * 100
              return (
                <div key={row.key} className="flex items-center gap-3">
                  <span className="w-48 text-sm text-gray-700 truncate" title={row.label}>{row.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-sm font-semibold text-gray-900">{row.count}</span>
                  <span className="w-12 text-right text-xs text-gray-400">{pct}%</span>
                </div>
              )
            })}
          </div>

          {/* Ultime note */}
          {negativeNotes.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Note ({negativeNotes.length})</h4>
              <div className="space-y-2">
                {visibleNotes.map(n => (
                  <div key={n.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span>{new Date(n.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
                      <span>·</span>
                      <span className="font-medium text-gray-700">{n.operator_name}</span>
                      {n.reason && (
                        <>
                          <span>·</span>
                          <span className="italic">{NEGATIVE_REASON_LABELS[n.reason as keyof typeof NEGATIVE_REASON_LABELS] || n.reason}</span>
                        </>
                      )}
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap break-words">{n.notes}</p>
                  </div>
                ))}
              </div>
              {negativeNotes.length > 10 && (
                <button
                  onClick={() => setShowAllNotes(v => !v)}
                  className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  {showAllNotes ? 'Mostra meno' : `Mostra tutte (${negativeNotes.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">Distribuzione esiti</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={50}
                dataKey="value"
                label={(props) => `${props.name || ''} ${((props.percent || 0) * 100).toFixed(0)}%`}
                strokeWidth={0}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Operator table */}
      {operatorSummaries.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-x-auto">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">Riepilogo per operatrice</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="pb-3 font-semibold text-gray-500">Operatrice</th>
                <th className="pb-3 text-center font-semibold text-gray-500">Non risp.</th>
                <th className="pb-3 text-center font-semibold text-gray-500">Negativi</th>
                <th className="pb-3 text-center font-semibold text-gray-500">Appuntam.</th>
                <th className="pb-3 text-center font-bold text-gray-700">Totale</th>
                <th className="pb-3 text-center font-semibold text-gray-500">Ore lavoro</th>
                <th className="pb-3 text-center font-semibold text-gray-500">App/ora</th>
              </tr>
            </thead>
            <tbody>
              {operatorSummaries.map(op => {
                const h = Math.floor(op.minutes_worked / 60)
                const m = op.minutes_worked % 60
                const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`
                return (
                  <tr key={op.user_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 font-medium text-gray-900">{op.user_name}</td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-orange-50 text-orange-600 font-semibold text-sm">{op.non_risponde}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 font-semibold text-sm">{op.negativo}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 font-semibold text-sm">{op.appuntamento}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-sm">{op.total}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-sm font-medium text-gray-600">{op.minutes_worked > 0 ? timeStr : '-'}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-sm font-bold ${op.redemption > 0 ? 'bg-purple-50 text-purple-700' : 'text-gray-300'}`}>
                        {op.redemption > 0 ? op.redemption : '-'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
