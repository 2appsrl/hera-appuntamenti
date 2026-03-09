import type { OutcomeSummary } from '@/lib/types'

export default function SummaryCards({ counts }: { counts: OutcomeSummary }) {
  const total = counts.non_risponde + counts.negativo + counts.appuntamento
  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-orange-600">{counts.non_risponde}</div>
        <div className="text-sm text-orange-600">Non risponde</div>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-red-600">{counts.negativo}</div>
        <div className="text-sm text-red-600">Negativi</div>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-green-600">{counts.appuntamento}</div>
        <div className="text-sm text-green-600">Appuntamenti</div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <div className="text-3xl font-bold text-blue-600">{total}</div>
        <div className="text-sm text-blue-600">Totale</div>
      </div>
    </div>
  )
}
