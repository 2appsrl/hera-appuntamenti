'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import type { OutcomeSummary, DailyOutcomeSummary, OperatorSummary } from '@/lib/types'

const COLORS = { non_risponde: '#f97316', negativo: '#ef4444', appuntamento: '#22c55e' }

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
}

export default function AdminDashboard({
  dailyData,
  operatorSummaries,
  appointments,
  counts,
}: {
  dailyData: DailyOutcomeSummary[]
  operatorSummaries: OperatorSummary[]
  appointments: AppointmentRow[]
  counts: OutcomeSummary
}) {
  const total = counts.non_risponde + counts.negativo + counts.appuntamento
  const pieData = [
    { name: 'Non risponde', value: counts.non_risponde, color: COLORS.non_risponde },
    { name: 'Negativi', value: counts.negativo, color: COLORS.negativo },
    { name: 'Appuntamenti', value: counts.appuntamento, color: COLORS.appuntamento },
  ].filter(d => d.value > 0)

  function exportCSV() {
    const headers = ['Data', 'Ora', 'Cliente', 'Telefono', 'Agente', 'Luogo', 'Note', 'Operatrice']
    const rows = appointments.map(a => [
      a.appointment_date,
      a.appointment_time?.slice(0, 5),
      `${a.client_name} ${a.client_surname}`,
      a.client_phone,
      a.agents?.name || '',
      a.location,
      a.notes || '',
      a.users?.name || '',
    ])

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appuntamenti-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Charts */}
      {dailyData.length > 1 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <h3 className="font-semibold text-gray-700 mb-4">Andamento giornaliero</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="non_risponde" name="Non risponde" stroke={COLORS.non_risponde} strokeWidth={2} />
              <Line type="monotone" dataKey="negativo" name="Negativi" stroke={COLORS.negativo} strokeWidth={2} />
              <Line type="monotone" dataKey="appuntamento" name="Appuntamenti" stroke={COLORS.appuntamento} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {total > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <h3 className="font-semibold text-gray-700 mb-4">Distribuzione esiti</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={(props) => `${props.name || ''} ${((props.percent || 0) * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Operator table */}
      {operatorSummaries.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border overflow-x-auto">
          <h3 className="font-semibold text-gray-700 mb-4">Riepilogo per operatrice</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Operatrice</th>
                <th className="pb-2 text-center">Non risp.</th>
                <th className="pb-2 text-center">Negativi</th>
                <th className="pb-2 text-center">Appuntamenti</th>
                <th className="pb-2 text-center font-bold">Totale</th>
              </tr>
            </thead>
            <tbody>
              {operatorSummaries.map(op => (
                <tr key={op.user_id} className="border-b">
                  <td className="py-2">{op.user_name}</td>
                  <td className="py-2 text-center text-orange-600">{op.non_risponde}</td>
                  <td className="py-2 text-center text-red-600">{op.negativo}</td>
                  <td className="py-2 text-center text-green-600">{op.appuntamento}</td>
                  <td className="py-2 text-center font-bold">{op.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Appointments list */}
      <div className="bg-white rounded-lg p-4 shadow-sm border overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700">Appuntamenti fissati ({appointments.length})</h3>
          {appointments.length > 0 && (
            <button onClick={exportCSV}
              className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200 cursor-pointer">
              Export CSV
            </button>
          )}
        </div>
        {appointments.length === 0 ? (
          <p className="text-gray-500 text-sm">Nessun appuntamento nel periodo selezionato</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Data</th>
                <th className="pb-2">Ora</th>
                <th className="pb-2">Cliente</th>
                <th className="pb-2">Telefono</th>
                <th className="pb-2">Agente</th>
                <th className="pb-2">Luogo</th>
                <th className="pb-2">Operatrice</th>
                <th className="pb-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{a.appointment_date}</td>
                  <td className="py-2">{a.appointment_time?.slice(0, 5)}</td>
                  <td className="py-2">{a.client_name} {a.client_surname}</td>
                  <td className="py-2">{a.client_phone}</td>
                  <td className="py-2">{a.agents?.name}</td>
                  <td className="py-2">{a.location}</td>
                  <td className="py-2">{a.users?.name}</td>
                  <td className="py-2 text-gray-500">{a.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
