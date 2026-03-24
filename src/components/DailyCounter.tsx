import type { OutcomeSummary } from '@/lib/types'

export default function DailyCounter({ counts }: { counts: OutcomeSummary }) {
  const total = counts.non_risponde + counts.negativo + counts.appuntamento

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Oggi</h2>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
          {total} totali
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
          <div className="text-3xl font-extrabold text-orange-500">{counts.non_risponde}</div>
          <div className="text-xs font-medium text-gray-500 mt-1">Non risponde</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100 hover:shadow-md transition-shadow">
          <div className="text-3xl font-extrabold text-red-500">{counts.negativo}</div>
          <div className="text-xs font-medium text-gray-500 mt-1">Negativi</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100 hover:shadow-md transition-shadow">
          <div className="text-3xl font-extrabold text-emerald-500">{counts.appuntamento}</div>
          <div className="text-xs font-medium text-gray-500 mt-1">Appuntamenti</div>
        </div>
      </div>
    </div>
  )
}
