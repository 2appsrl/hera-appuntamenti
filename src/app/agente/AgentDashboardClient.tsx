'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setAppointmentOutcome } from './actions'
import type { AppointmentForAgent, AppointmentOutcomeType, AgentType } from '@/lib/types'

const DAY_NAMES = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato']

const OUTCOME_CONFIG = {
  positivo: { label: 'Positivo', color: 'bg-emerald-500 hover:bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: '✓' },
  negativo: { label: 'Negativo', color: 'bg-red-500 hover:bg-red-600', badge: 'bg-red-50 text-red-700 border border-red-200', icon: '✗' },
  non_presentato: { label: 'Non presentato', color: 'bg-gray-400 hover:bg-gray-500', badge: 'bg-gray-100 text-gray-600 border border-gray-200', icon: '—' },
}

export default function AgentDashboardClient({
  agentName,
  agentType,
  appointments,
  weekOffset,
  mondayStr,
  sundayStr,
}: {
  agentName: string
  agentType: AgentType
  appointments: AppointmentForAgent[]
  weekOffset: number
  mondayStr: string
  sundayStr: string
}) {
  const router = useRouter()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())

  function navigateWeek(offset: number) {
    router.push(`/agente?week=${weekOffset + offset}`)
  }

  async function handleSetOutcome(appointmentId: string, outcome: AppointmentOutcomeType) {
    setSaving(appointmentId)
    try {
      await setAppointmentOutcome(appointmentId, outcome, notes[appointmentId] || undefined)
      setSaved(prev => new Set(prev).add(appointmentId))
    } catch {
      alert('Errore nel salvataggio')
    } finally {
      setSaving(null)
    }
  }

  function exportCSV() {
    const headers = ['Data', 'Giorno', 'Ora', 'Cliente', 'Telefono', 'Luogo', 'Note', 'Esito']
    const rows = appointments.map(a => {
      const d = new Date(a.appointment_date + 'T00:00:00')
      return [
        a.appointment_date,
        DAY_NAMES[d.getDay()],
        a.appointment_time?.slice(0, 5),
        `${a.client_name} ${a.client_surname}`,
        a.client_phone,
        a.location,
        a.notes || '',
        a.appointment_outcomes ? OUTCOME_CONFIG[a.appointment_outcomes.outcome as AppointmentOutcomeType]?.label || '' : '',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agenda-${agentName}-${mondayStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group appointments by date
  const grouped = new Map<string, AppointmentForAgent[]>()
  appointments.forEach(apt => {
    const date = apt.appointment_date
    if (!grouped.has(date)) grouped.set(date, [])
    grouped.get(date)!.push(apt)
  })

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
  }

  return (
    <>
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigateWeek(-1)}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Sett. prec.
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">
            {new Date(mondayStr + 'T00:00:00').getDate()}/{new Date(mondayStr + 'T00:00:00').getMonth() + 1} - {new Date(sundayStr + 'T00:00:00').getDate()}/{new Date(sundayStr + 'T00:00:00').getMonth() + 1}
          </h2>
          <p className="text-xs text-gray-400">
            {agentType === 'agente' ? 'Agente' : 'Sportello'}: {agentName}
          </p>
        </div>
        <button onClick={() => navigateWeek(1)}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors cursor-pointer">
          Sett. succ.
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2 justify-end">
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSV
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Stampa
        </button>
      </div>

      {/* Appointments list */}
      {appointments.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-400">Nessun appuntamento questa settimana</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([date, dayAppointments]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {formatDate(date)}
              </h3>
              <div className="space-y-4">
                {dayAppointments.map(apt => {
                  const existingOutcome = apt.appointment_outcomes
                  const isSaving = saving === apt.id
                  const justSaved = saved.has(apt.id)

                  return (
                    <div key={apt.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      {/* Appointment info */}
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="bg-emerald-50 text-emerald-700 font-bold text-base px-3 py-2 rounded-xl shrink-0">
                            {apt.appointment_time.slice(0, 5)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 text-lg">{apt.client_name} {apt.client_surname}</div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                              <a href={`tel:${apt.client_phone}`} className="text-sm text-blue-600 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {apt.client_phone}
                              </a>
                              {apt.location && (
                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {apt.location}
                                </span>
                              )}
                            </div>
                            {apt.notes && (
                              <div className="text-sm text-gray-500 mt-2 bg-gray-50 rounded-lg p-2.5 whitespace-pre-wrap">
                                {apt.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Outcome section */}
                      {existingOutcome || justSaved ? (
                        // Outcome already set - show badge
                        <div className="px-4 pb-4">
                          <div className={`text-center py-2.5 rounded-xl text-sm font-semibold ${OUTCOME_CONFIG[(existingOutcome?.outcome || 'positivo') as AppointmentOutcomeType]?.badge}`}>
                            {OUTCOME_CONFIG[(existingOutcome?.outcome || 'positivo') as AppointmentOutcomeType]?.icon}{' '}
                            {OUTCOME_CONFIG[(existingOutcome?.outcome || 'positivo') as AppointmentOutcomeType]?.label}
                            {existingOutcome?.notes && (
                              <span className="font-normal text-xs ml-2">- {existingOutcome.notes}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        // Outcome not set - show big buttons + notes
                        <div className="border-t border-gray-100 p-4 space-y-3">
                          <textarea
                            value={notes[apt.id] || ''}
                            onChange={e => setNotes(prev => ({ ...prev, [apt.id]: e.target.value }))}
                            placeholder="Note sull'appuntamento (opzionale)..."
                            rows={2}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none resize-none"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => handleSetOutcome(apt.id, 'positivo')}
                              disabled={isSaving}
                              className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white py-4 rounded-xl text-base font-bold transition-colors cursor-pointer disabled:opacity-60 shadow-sm"
                            >
                              <span className="text-xl block">✓</span>
                              Positivo
                            </button>
                            <button
                              onClick={() => handleSetOutcome(apt.id, 'negativo')}
                              disabled={isSaving}
                              className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white py-4 rounded-xl text-base font-bold transition-colors cursor-pointer disabled:opacity-60 shadow-sm"
                            >
                              <span className="text-xl block">✗</span>
                              Negativo
                            </button>
                            <button
                              onClick={() => handleSetOutcome(apt.id, 'non_presentato')}
                              disabled={isSaving}
                              className="bg-gray-400 hover:bg-gray-500 active:bg-gray-600 text-white py-4 rounded-xl text-base font-bold transition-colors cursor-pointer disabled:opacity-60 shadow-sm"
                            >
                              <span className="text-xl block">—</span>
                              <span className="text-xs">Non presentato</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
