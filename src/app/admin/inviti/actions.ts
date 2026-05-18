'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCardsPdf, type CardData } from './generateCardPdf'

export interface InviteRequest {
  agentId: string
  sportelloId: string
}

export async function generateInvitiPdf(requests: InviteRequest[]): Promise<
  { pdfBase64: string } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') return { error: 'Non autorizzato' }

  if (!requests.length) return { error: 'Nessun agente selezionato' }

  const admin = createAdminClient()
  const agentIds = requests.map(r => r.agentId)
  const sportelloIds = requests.map(r => r.sportelloId)
  const allIds = Array.from(new Set([...agentIds, ...sportelloIds]))

  const { data: agents, error } = await admin
    .from('agents')
    .select('id, name, type, address, phone')
    .in('id', allIds)

  if (error) return { error: 'Errore nel caricamento dei dati' }

  const byId = new Map((agents || []).map(a => [a.id, a]))

  const cards: CardData[] = requests.map(r => {
    const agent = byId.get(r.agentId)
    const sportello = byId.get(r.sportelloId)
    return {
      agentName: agent?.name || 'Sconosciuto',
      sportelloName: sportello?.name || '—',
      sportelloAddress: sportello?.address || '',
      sportelloPhone: sportello?.phone || null,
    }
  })

  const bytes = await generateCardsPdf(cards)
  return { pdfBase64: Buffer.from(bytes).toString('base64') }
}
