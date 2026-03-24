'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import type { OutcomeSummary, DailyOutcomeSummary, OperatorSummary } from '@/lib/types'

const COLORS = { non_risponde: '#f97316', negativo: '#ef4444', appuntamento: '#22c55e' }

export default function AdminDashboard({
  dailyData,
  operatorSummaries,
  counts,
}: {
  dailyData: DailyOutcomeSummary[]
  operatorSummaries: OperatorSummary[]
  counts: OutcomeSummary
}) {
  const total = counts.non_risponde + counts.negativo + counts.appuntamento
  const pieData = [
    { name: 'Non risponde', value: counts.non_risponde, color: COLORS.non_risponde },
    { name: 'Negativi', value: counts.negativo, color: COLORS.negativo },
    { name: 'Appuntamenti', value: counts.appuntamento, color: COLORS.appuntamento },
  ].filter(d => d.value > 0)

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
