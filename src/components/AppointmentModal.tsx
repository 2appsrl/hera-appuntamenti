'use client'

import { useState, useMemo } from 'react'
import { createAppointment } from '@/app/operatore/actions'
import type { Agent, AgentAvailability } from '@/lib/types'

const DAY_NAMES = ['Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato', 'Domenica']

// Convert JS Date.getDay() (0=Sun) to our schema (0=Mon)
function jsToSchemaDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

export default function AppointmentModal({
  agents,
  availability,
  onClose,
}: {
  agents: Pick<Agent, 'id' | 'name' | 'type'>[]
  availability: AgentAvailability[]
  onClose: () => void
}) {
  const [form, setForm] = useState({
    clientName: '',
    clientSurname: '',
    clientPhone: '',
    agentId: '',
    appointmentDate: '',
    appointmentTime: '',
    location: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const agentAvailability = useMemo(() => {
    if (!form.agentId) return []
    return availability.filter(a => a.agent_id === form.agentId)
  }, [form.agentId, availability])

  const availableDays = useMemo(() => {
    return new Set(agentAvailability.map(a => a.day_of_week))
  }, [agentAvailability])

  const timeSlots = useMemo(() => {
    if (!form.agentId || !form.appointmentDate) return []
    const date = new Date(form.appointmentDate)
    const schemaDay = jsToSchemaDay(date.getDay())
    return agentAvailability
      .filter(a => a.day_of_week === schemaDay)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [form.agentId, form.appointmentDate, agentAvailability])

  function isDateAvailable(dateStr: string): boolean {
    if (!dateStr || availableDays.size === 0) return false
    const date = new Date(dateStr)
    return availableDays.has(jsToSchemaDay(date.getDay()))
  }

  function update(field: string, value: string) {
    setForm(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'agentId') { updated.appointmentDate = ''; updated.appointmentTime = '' }
      if (field === 'appointmentDate') { updated.appointmentTime = '' }
      return updated
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!isDateAvailable(form.appointmentDate)) {
      setError("La data selezionata non e' disponibile per questo agente")
      return
    }

    setSaving(true)
    try {
      await createAppointment(form)
      onClose()
    } catch {
      setError('Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">Nuovo Appuntamento</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text" required value={form.clientName}
                onChange={e => update('clientName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
              <input
                type="text" required value={form.clientSurname}
                onChange={e => update('clientSurname', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cellulare</label>
            <input
              type="tel" required value={form.clientPhone}
              onChange={e => update('clientPhone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agente / Sportello</label>
            <select
              required value={form.agentId}
              onChange={e => update('agentId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Seleziona...</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type === 'agente' ? 'Agente' : 'Sportello'})
                </option>
              ))}
            </select>
          </div>

          {form.agentId && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              Disponibile: {agentAvailability.length === 0
                ? "Nessuna disponibilita' impostata"
                : [...new Set(agentAvailability.map(a => a.day_of_week))].sort().map(d => DAY_NAMES[d]).join(', ')
              }
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input
              type="date" required value={form.appointmentDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => update('appointmentDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {form.appointmentDate && !isDateAvailable(form.appointmentDate) && (
              <p className="text-red-500 text-xs mt-1">L&apos;agente non e&apos; disponibile in questo giorno</p>
            )}
          </div>

          {timeSlots.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ora</label>
              <select
                required value={form.appointmentTime}
                onChange={e => update('appointmentTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Seleziona fascia...</option>
                {timeSlots.map((slot, i) => (
                  <option key={i} value={slot.start_time}>
                    {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Luogo</label>
            <input
              type="text" required value={form.location}
              onChange={e => update('location', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving ? 'Salvataggio...' : 'SALVA APPUNTAMENTO'}
          </button>
        </form>
      </div>
    </div>
  )
}
