'use client'

import { useEffect, useState } from 'react'
import { NEGATIVE_REASON_ORDER, NEGATIVE_REASON_LABELS, MAX_NEGATIVE_NOTES_LEN } from '@/lib/types'
import type { NegativeReason } from '@/lib/types'

export default function NegativeOutcomeModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: (reason: NegativeReason, notes: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState<NegativeReason | null>(null)
  const [notes, setNotes] = useState('')
  const [prevOpen, setPrevOpen] = useState(open)

  // Reset state on open (during render, per React 19 derived-state pattern)
  if (open && !prevOpen) {
    setReason(null)
    setNotes('')
    setPrevOpen(true)
  } else if (!open && prevOpen) {
    setPrevOpen(false)
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const canConfirm = reason !== null
  const notesLeft = MAX_NEGATIVE_NOTES_LEN - notes.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Esito negativo</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Chiudi"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo</label>
          <div className="space-y-2">
            {NEGATIVE_REASON_ORDER.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  reason === r
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-red-500"
                />
                <span className="text-sm text-gray-800">{NEGATIVE_REASON_LABELS[r]}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Note negativo <span className="text-gray-400 font-normal">(opzionale)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, MAX_NEGATIVE_NOTES_LEN))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent resize-none"
            placeholder="Dettagli aggiuntivi..."
          />
          <div className="text-xs text-gray-400 text-right mt-1">{notesLeft} caratteri rimasti</div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            Annulla
          </button>
          <button
            onClick={() => reason && onConfirm(reason, notes)}
            disabled={!canConfirm}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  )
}
