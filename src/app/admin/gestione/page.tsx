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

  if (!profile || profile.role !== 'superadmin') redirect('/operatore')

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
    <div className="min-h-screen bg-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Gestione</h2>
          <a href="/admin" className="text-sm text-blue-600 hover:text-blue-800">&larr; Dashboard</a>
        </div>
        <AgentManager agents={agents || []} availability={availability || []} />
        <OperatorManager operators={operators || []} />
      </main>
    </div>
  )
}
