'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeAddress } from '@/lib/geocode'
import { searchEstateAgentsNearby } from '@/lib/overpass'
import type { AgencyResult } from '@/lib/types'

export async function searchNearbyAgencies(
  sportelloId: string,
): Promise<{ agencies: AgencyResult[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'superadmin') return { error: 'Non autorizzato' }

  const admin = createAdminClient()
  const { data: sportello } = await admin
    .from('agents')
    .select('id, name, type, address, lat, lng')
    .eq('id', sportelloId)
    .single()

  if (!sportello) return { error: 'Sportello non trovato' }
  if (sportello.type !== 'sportello') return { error: 'L\'agente selezionato non è uno sportello' }
  if (!sportello.address) return { error: 'Indirizzo dello sportello mancante (impostalo da Gestione)' }

  // Geocodifica lazy
  let lat = sportello.lat as number | null
  let lng = sportello.lng as number | null
  if (lat === null || lng === null) {
    try {
      const geo = await geocodeAddress(sportello.address)
      if (!geo) return { error: 'Indirizzo dello sportello non geolocalizzato — verifica il testo in Gestione' }
      lat = geo.lat
      lng = geo.lng
      // Cache in DB (best-effort, non bloccante)
      await admin.from('agents').update({ lat, lng }).eq('id', sportelloId)
    } catch (e) {
      return { error: e instanceof Error ? `Errore geocodifica: ${e.message}` : 'Errore geocodifica' }
    }
  }

  try {
    const agencies = await searchEstateAgentsNearby(lat, lng, 5000)
    return { agencies }
  } catch (e) {
    return { error: e instanceof Error ? `Errore ricerca OSM: ${e.message}` : 'Errore ricerca OSM' }
  }
}
