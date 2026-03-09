'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Header({ userName, role }: { userName: string; role: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Hera Appuntamenti</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{userName}</span>
          {role === 'superadmin' && (
            <a href="/admin" className="text-sm text-blue-600 hover:text-blue-800">Dashboard</a>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Esci
          </button>
        </div>
      </div>
    </header>
  )
}
