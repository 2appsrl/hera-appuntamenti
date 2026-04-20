'use client'

import { useRef, useState } from 'react'
import { recordOutcome } from '@/app/operatore/actions'
import type { OutcomeType, OutcomeSummary } from '@/lib/types'
import NegativeOutcomeModal from '@/components/NegativeOutcomeModal'
import type { NegativeReason } from '@/lib/types'

export default function OutcomeButtons({
  onAppointmentClick,
  onOptimisticUpdate,
}: {
  onAppointmentClick: () => void
  onOptimisticUpdate?: (outcome: keyof OutcomeSummary) => void
}) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [negativeModalOpen, setNegativeModalOpen] = useState(false)

  function handleOutcome(outcome: OutcomeType) {
    if (outcome === 'appuntamento') {
      onAppointmentClick()
      return
    }
    if (outcome === 'negativo') {
      setNegativeModalOpen(true)
      return
    }

    // non_risponde: fire-and-forget as before
    onOptimisticUpdate?.(outcome)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    setFeedback('Non risponde ✓')
    feedbackTimer.current = setTimeout(() => setFeedback(null), 800)
    recordOutcome(outcome).catch(() => {
      setFeedback('Errore nel salvataggio')
      feedbackTimer.current = setTimeout(() => setFeedback(null), 2000)
    })
  }

  function handleNegativeConfirm(reason: NegativeReason, notes: string) {
    setNegativeModalOpen(false)
    onOptimisticUpdate?.('negativo')
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    setFeedback('Negativo ✓')
    feedbackTimer.current = setTimeout(() => setFeedback(null), 800)
    recordOutcome('negativo', { negativeReason: reason, negativeNotes: notes }).catch(() => {
      setFeedback('Errore nel salvataggio')
      feedbackTimer.current = setTimeout(() => setFeedback(null), 2000)
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleOutcome('non_risponde')}
          className="group relative overflow-hidden bg-gradient-to-br from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 active:scale-[0.97] text-white font-bold py-14 px-6 rounded-2xl text-lg leading-snug transition-all duration-200 shadow-[0_8px_30px_rgba(249,115,22,0.3)] hover:shadow-[0_8px_40px_rgba(249,115,22,0.45)] cursor-pointer"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center gap-3">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6m0 0v6m0-6L13 11" />
            </svg>
            <span className="text-center">NON RISPONDE<br/>OCCUPATO<br/>RICHIAMARE</span>
          </div>
        </button>

        <button
          onClick={() => handleOutcome('negativo')}
          className="group relative overflow-hidden bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 active:scale-[0.97] text-white font-bold py-14 px-6 rounded-2xl text-lg transition-all duration-200 shadow-[0_8px_30px_rgba(239,68,68,0.3)] hover:shadow-[0_8px_40px_rgba(239,68,68,0.45)] cursor-pointer"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center gap-3">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span>NEGATIVO</span>
          </div>
        </button>
      </div>

      <button
        onClick={() => handleOutcome('appuntamento')}
        className="group relative overflow-hidden w-full bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 active:scale-[0.97] text-white font-bold py-16 px-6 rounded-2xl text-2xl transition-all duration-200 shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_40px_rgba(16,185,129,0.45)] cursor-pointer"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex flex-col items-center gap-3">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>APPUNTAMENTO FISSATO</span>
        </div>
      </button>

      {feedback && (
        <div className="text-center py-2.5 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium shadow-lg">
          {feedback}
        </div>
      )}

      <NegativeOutcomeModal
        open={negativeModalOpen}
        onConfirm={handleNegativeConfirm}
        onCancel={() => setNegativeModalOpen(false)}
      />
    </div>
  )
}
