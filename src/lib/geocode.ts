/**
 * Geocodifica un indirizzo in lat/lng tramite Nominatim (OSM).
 * Restituisce null se l'indirizzo non viene trovato.
 *
 * Rispetta le policy Nominatim:
 *  - User-Agent identificativo obbligatorio
 *  - max 1 req/sec (chi chiama deve serializzare se serve)
 *  - https://operations.osmfoundation.org/policies/nominatim/
 */
export interface GeocodeResult {
  lat: number
  lng: number
}

const USER_AGENT = 'Hera-Appuntamenti/1.0 (commerciale@deagroup.biz)'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const url = new URL(NOMINATIM_URL)
  url.searchParams.set('q', address)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'it')

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'it' },
    // Nominatim può essere lento — timeout via AbortController
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`Nominatim ${res.status}`)

  const body = (await res.json()) as Array<{ lat: string; lon: string }>
  if (!body.length) return null

  return { lat: parseFloat(body[0].lat), lng: parseFloat(body[0].lon) }
}
