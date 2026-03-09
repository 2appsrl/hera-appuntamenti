import type { OutcomeSummary } from '@/lib/types'

export default function DailyCounter({ counts }: { counts: OutcomeSummary }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <div className="text-2xl font-bold text-orange-600">{counts.non_risponde}</div>
        <div className="text-xs text-orange-600">Non risponde</div>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <div className="text-2xl font-bold text-red-600">{counts.negativo}</div>
        <div className="text-xs text-red-600">Negativi</div>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="text-2xl font-bold text-green-600">{counts.appuntamento}</div>
        <div className="text-xs text-green-600">Appuntamenti</div>
      </div>
    </div>
  )
}
