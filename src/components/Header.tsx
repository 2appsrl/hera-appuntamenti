'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Header({ userName, role }: { userName: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200/50">
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900">Hera</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-sm font-medium text-gray-700">{userName}</span>
          </div>
          {role === 'superadmin' && (
            <>
              <a href="/admin" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">Dashboard</a>
              <a href="/admin/appuntamenti" className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors">Appuntamenti</a>
              <a href="/admin/fasce-orarie" className="text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors">Fasce Orarie</a>
            </>
          )}
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            Esci
          </button>
        </div>
      </div>
    </header>
  )
}
