'use client'

import { useState } from 'react'
import { recordOutcome } from '@/app/operatore/actions'
import type { OutcomeType } from '@/lib/types'

export default function OutcomeButtons({ onAppointmentClick }: { onAppointmentClick: () => void }) {
  const [feedback, setFeedback] = useState<string | null>(null)

  async function handleOutcome(outcome: OutcomeType) {
    if (outcome === 'appuntamento') {
      onAppointmentClick()
      return
    }

    try {
      await recordOutcome(outcome)
      setFeedback(outcome === 'non_risponde' ? 'Non risponde registrato' : 'Negativo registrato')
      setTimeout(() => setFeedback(null), 1500)
    } catch {
      setFeedback('Errore nel salvataggio')
      setTimeout(() => setFeedback(null), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleOutcome('non_risponde')}
          className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-8 px-4 rounded-xl text-base leading-tight transition-all shadow-lg cursor-pointer"
        >
          NON RISPONDE /<br />OCCUPATO /<br />RICHIAMARE
        </button>
        <button
          onClick={() => handleOutcome('negativo')}
          className="bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold py-8 px-4 rounded-xl text-lg transition-all shadow-lg cursor-pointer"
        >
          NEGATIVO
        </button>
      </div>
      <button
        onClick={() => handleOutcome('appuntamento')}
        className="w-full bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold py-10 px-4 rounded-xl text-xl transition-all shadow-lg cursor-pointer"
      >
        APPUNTAMENTO FISSATO
      </button>
      {feedback && (
        <div className="text-center py-2 px-4 bg-gray-800 text-white rounded-lg animate-pulse">
          {feedback}
        </div>
      )}
    </div>
  )
}
