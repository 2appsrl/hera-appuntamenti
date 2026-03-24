import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import AgentManager from './AgentManager'
import OperatorManager from './OperatorManager'

export default async function GestionePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'superadmin') {
    redirect(profile?.role === 'agente' ? '/agente' : profile?.role === 'operatore' ? '/operatore' : '/login')
  }

  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .order('name')

  const { data: availability } = await supabase
    .from('agent_availability')
    .select('*')

  const { data: operators } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'operatore')
    .order('name')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Gestione</h2>
          <a href="/admin" className="group flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </a>
        </div>
        <AgentManager agents={agents || []} availability={availability || []} />
        <OperatorManager operators={operators || []} />
      </main>
    </div>
  )
}
