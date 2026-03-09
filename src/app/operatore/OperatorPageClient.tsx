'use client'

import { useState } from 'react'
import OutcomeButtons from '@/components/OutcomeButtons'
import AppointmentModal from '@/components/AppointmentModal'
import type { Agent, AgentAvailability, AppointmentWithAgent } from '@/lib/types'

export default function OperatorPageClient({
  agents,
  availability,
  todayAppointments,
}: {
  agents: Pick<Agent, 'id' | 'name' | 'type'>[]
  availability: AgentAvailability[]
  todayAppointments: AppointmentWithAgent[]
}) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <OutcomeButtons onAppointmentClick={() => setShowModal(true)} />

      {showModal && (
        <AppointmentModal
          agents={agents}
          availability={availability}
          onClose={() => setShowModal(false)}
        />
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Appuntamenti di oggi ({todayAppointments.length})
        </h2>
        {todayAppointments.length === 0 ? (
          <p className="text-gray-500 text-sm">Nessun appuntamento oggi</p>
        ) : (
          <div className="space-y-2">
            {todayAppointments.map((apt) => (
              <div key={apt.id} className="bg-white rounded-lg p-3 shadow-sm border">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">{apt.appointment_time.slice(0, 5)}</span>
                    {' '}
                    <span>{apt.client_name} {apt.client_surname}</span>
                  </div>
                  <span className="text-sm text-gray-500">{apt.agents?.name}</span>
                </div>
                {apt.location && (
                  <div className="text-sm text-gray-500 mt-1">{apt.location}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
