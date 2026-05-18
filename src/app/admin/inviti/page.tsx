import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/Header'
import InvitiPageClient from './InvitiPageClient'

export const dynamic = 'force-dynamic'

export default async function InvitiPage() {
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

  const admin = createAdminClient()

  // Fetch active agents (type='agente') and active sportelli
  const [agentsRes, sportelliRes] = await Promise.all([
    admin.from('agents').select('id, name').eq('type', 'agente').eq('active', true).order('name'),
    admin.from('agents').select('id, name, address, phone').eq('type', 'sportello').eq('active', true).order('name'),
  ])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header userName={profile.name} role={profile.role} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <InvitiPageClient
          agents={agentsRes.data || []}
          sportelli={sportelliRes.data || []}
        />
      </main>
    </div>
  )
}
