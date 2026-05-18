import type { AgencyResult } from '@/lib/types'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'Hera-Appuntamenti/1.0 (commerciale@deagroup.biz)'

interface OverpassNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassNode[]
}

function buildAddress(tags: Record<string, string>): string {
  const street = tags['addr:street']
  const number = tags['addr:housenumber']
  const city = tags['addr:city']
  const parts: string[] = []
  if (street) parts.push(number ? `${street} ${number}` : street)
  if (city) parts.push(city)
  return parts.length ? parts.join(', ') : 'Indirizzo non specificato'
}

function pickPhone(tags: Record<string, string>): string | null {
  return tags['contact:phone'] || tags['phone'] || null
}

/**
 * Cerca agenzie immobiliari entro `radiusMeters` da (lat,lng) via Overpass.
 * Tags coperti: office=estate_agent OR shop=real_estate.
 */
export async function searchEstateAgentsNearby(
  lat: number,
  lng: number,
  radiusMeters = 5000,
): Promise<AgencyResult[]> {
  const query = `
[out:json][timeout:25];
(
  node["office"="estate_agent"](around:${radiusMeters},${lat},${lng});
  node["shop"="real_estate"](around:${radiusMeters},${lat},${lng});
);
out body 200;
`

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(40000),
  })

  if (!res.ok) throw new Error(`Overpass ${res.status}`)

  const data = (await res.json()) as OverpassResponse

  // Dedup per id (caso raro: stesso nodo restituito da entrambi i tag set)
  const seen = new Set<number>()
  const results: AgencyResult[] = []
  for (const n of data.elements) {
    if (seen.has(n.id)) continue
    seen.add(n.id)
    const tags = n.tags || {}
    results.push({
      osmId: String(n.id),
      name: tags.name || 'Senza nome',
      address: buildAddress(tags),
      phone: pickPhone(tags),
      lat: n.lat,
      lng: n.lon,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${n.lat},${n.lon}`,
    })
  }

  // Ordinamento: prima quelle col telefono, poi per nome
  results.sort((a, b) => {
    if ((a.phone === null) !== (b.phone === null)) return a.phone === null ? 1 : -1
    return a.name.localeCompare(b.name, 'it')
  })

  return results
}
