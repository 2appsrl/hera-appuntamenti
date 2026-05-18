# Trova agenzie immobiliari — Piano di implementazione

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggiungere alla pagina `/admin/inviti` una sezione che, dato uno sportello, trova via OpenStreetMap le agenzie immobiliari entro 5 km e le mostra in tabella + esporta in CSV.

**Architecture:** Nominatim per geocodificare l'indirizzo dello sportello (con cache lazy in `agents.lat/lng`), Overpass API per cercare nodi `office=estate_agent` / `shop=real_estate` nel raggio. Server action stateless che restituisce JSON, client component che rende tabella + CSV.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres, TypeScript, Tailwind, fetch nativo per OSM (nessuna nuova dipendenza).

**Verifica:** progetto senza test runner. Per ogni task:
- `npx tsc --noEmit` (no errori nuovi)
- `npx eslint <files>` (no errori nuovi)
- Per le chiamate OSM: smoke test manuale (via preview o Bash curl)

Design di riferimento: `docs/plans/2026-05-18-trova-agenzie-immobiliari-design.md`.

Riferimento skill: @superpowers:verification-before-completion.

---

## Task 1: Migration `agents.lat` e `agents.lng`

**Files:**
- Modify: `supabase/schema.sql` (documentazione)

**Step 1: Applicare la migration**

Tool: `mcp__42edcf0e-514f-4173-b1a8-a59c2bb92d01__apply_migration`
Project id: `ihttvrfhbcznynqhobrm`
Name: `add_lat_lng_to_agents`

```sql
ALTER TABLE agents
  ADD COLUMN lat DOUBLE PRECISION,
  ADD COLUMN lng DOUBLE PRECISION;
```

**Step 2: Verificare**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='agents' AND column_name IN ('lat','lng')
ORDER BY column_name;
```

Expected: 2 righe, entrambe `data_type='double precision'`, `is_nullable='YES'`.

**Step 3: Aggiornare `supabase/schema.sql`**

Nella definizione di `agents` (dopo `phone TEXT,`), aggiungere:

```sql
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
```

**Step 4: Commit**

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti"
git add supabase/schema.sql
git commit -m "feat(db): add lat/lng cache columns to agents"
```

---

## Task 2: Tipi TypeScript

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Estendere `Agent` e aggiungere `AgencyResult`**

In `src/lib/types.ts`:

1. All'interno dell'interfaccia `Agent` (dopo `phone: string | null`), aggiungere:

```ts
  lat: number | null
  lng: number | null
```

2. Aggiungere alla fine del file:

```ts
export interface AgencyResult {
  osmId: string
  name: string
  address: string
  phone: string | null
  lat: number
  lng: number
  mapsUrl: string
}
```

**Step 2: Verificare**

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npx tsc --noEmit
```

Expected: clean.

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add lat/lng on Agent and AgencyResult interface"
```

---

## Task 3: Modulo geocodifica Nominatim

**Files:**
- Create: `src/lib/geocode.ts`

**Step 1: Scrivere il modulo**

```ts
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
```

**Step 2: Verificare**

```bash
npx tsc --noEmit
npx eslint --no-warn-ignored src/lib/geocode.ts 2>&1 | tail -5
```

Expected: clean.

**Step 3: Smoke test (opzionale)**

```bash
curl -s "https://nominatim.openstreetmap.org/search?q=Via+Roma+12+Milano&format=json&limit=1&countrycodes=it" \
  -H "User-Agent: Hera-Appuntamenti/1.0 test" | head -c 300
```

Expected: array JSON con almeno un risultato. Se vuoto, prova un altro indirizzo certamente esistente.

**Step 4: Commit**

```bash
git add src/lib/geocode.ts
git commit -m "feat(geocode): Nominatim geocoding helper"
```

---

## Task 4: Modulo Overpass

**Files:**
- Create: `src/lib/overpass.ts`

**Step 1: Scrivere il modulo**

```ts
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
```

**Step 2: Verificare**

```bash
npx tsc --noEmit
npx eslint --no-warn-ignored src/lib/overpass.ts 2>&1 | tail -5
```

Expected: clean.

**Step 3: Smoke test (opzionale)**

```bash
curl -s -X POST https://overpass-api.de/api/interpreter \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode 'data=[out:json][timeout:25]; node["office"="estate_agent"](around:2000,45.4642,9.1900); out body 5;' \
  | head -c 500
```

Expected: JSON con `elements[]` contenente almeno qualche nodo (centro Milano).

**Step 4: Commit**

```bash
git add src/lib/overpass.ts
git commit -m "feat(overpass): query Overpass for nearby real estate agencies"
```

---

## Task 5: Server action `searchNearbyAgencies`

**Files:**
- Create: `src/app/admin/inviti/searchAgencies.ts`

**Step 1: Scrivere l'action**

```ts
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
```

**Step 2: Verificare**

```bash
npx tsc --noEmit
npx eslint --no-warn-ignored src/app/admin/inviti/searchAgencies.ts 2>&1 | tail -5
```

Expected: clean.

**Step 3: Commit**

```bash
git add src/app/admin/inviti/searchAgencies.ts
git commit -m "feat(api): server action to search nearby real estate agencies"
```

---

## Task 6: Sezione UI "Trova agenzie immobiliari"

**Files:**
- Modify: `src/app/admin/inviti/page.tsx` (verifica già passa `sportelli`)
- Modify: `src/app/admin/inviti/InvitiPageClient.tsx`

**Step 1: Aggiornare `page.tsx`**

Verificare che `sportelli` sia già passato a `InvitiPageClient` (lo è dal Task 7 della feature precedente). Niente da fare se è già lì.

**Step 2: Aggiungere stato e handler nel client**

In cima a `InvitiPageClient.tsx`, aggiungere l'import della server action:

```tsx
import { searchNearbyAgencies } from './searchAgencies'
import type { AgencyResult } from '@/lib/types'
```

Aggiungere nello stato della componente (dopo `error`, prima di `function toggleAll`):

```tsx
const [searchSportelloId, setSearchSportelloId] = useState('')
const [searchLoading, setSearchLoading] = useState(false)
const [searchError, setSearchError] = useState<string | null>(null)
const [agencies, setAgencies] = useState<AgencyResult[] | null>(null)
```

Aggiungere gli handler subito sotto `handleGenerate`:

```tsx
async function handleSearch() {
  setSearchError(null)
  setAgencies(null)
  if (!searchSportelloId) { setSearchError('Scegli uno sportello'); return }
  setSearchLoading(true)
  try {
    const result = await searchNearbyAgencies(searchSportelloId)
    if ('error' in result) {
      setSearchError(result.error)
      return
    }
    setAgencies(result.agencies)
  } catch (e) {
    setSearchError(e instanceof Error ? e.message : 'Errore inatteso')
  } finally {
    setSearchLoading(false)
  }
}

function handleExportCsv() {
  if (!agencies || agencies.length === 0) return
  const sportelloName = sportelli.find(s => s.id === searchSportelloId)?.name || 'sportello'
  const headers = ['Nome', 'Indirizzo', 'Telefono', 'Lat', 'Lng', 'Mappa']
  const rows = agencies.map(a => [
    a.name,
    a.address,
    a.phone || '',
    String(a.lat),
    String(a.lng),
    a.mapsUrl,
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().split('T')[0]
    a.download = `agenzie-${sportelloName.replace(/\s+/g, '-').toLowerCase()}-${date}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
```

**Step 3: Renderizzare la sezione UI**

Subito sotto l'`<h1>Biglietti invito</h1>` e il suo blocco, inserire la nuova sezione PRIMA del blocco "Genera PDF / tabella agenti". Inserire un nuovo `<div className="space-y-6">` di sezione, o aggiungere all'inizio del JSX di ritorno.

Posizionamento consigliato: inserire la nuova sezione come PRIMA card sotto l'header della pagina, sopra al banner di errore esistente:

```tsx
{/* Sezione Trova agenzie immobiliari */}
<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
    <div>
      <h2 className="text-lg font-bold text-gray-900">Trova agenzie immobiliari</h2>
      <p className="text-sm text-gray-500 mt-0.5">
        Cerca agenzie entro 5 km da uno sportello (dati OpenStreetMap, gratuito).
      </p>
    </div>
    <div className="flex items-center gap-2">
      <select
        value={searchSportelloId}
        onChange={e => setSearchSportelloId(e.target.value)}
        aria-label="Sportello per la ricerca"
        className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 min-w-[200px]"
      >
        <option value="">— scegli sportello —</option>
        {sportelli.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <button
        onClick={handleSearch}
        disabled={searchLoading || !searchSportelloId}
        aria-busy={searchLoading}
        className="bg-rose-600 hover:bg-rose-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-xl text-sm shadow-sm transition-colors cursor-pointer inline-flex items-center gap-2"
      >
        {searchLoading && (
          <svg aria-hidden="true" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {searchLoading ? 'Ricerca...' : 'Cerca a 5 km'}
      </button>
    </div>
  </div>

  {searchError && (
    <div role="alert" className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm">
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {searchError}
    </div>
  )}

  {agencies !== null && (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{agencies.length} agenzie trovate</span>
        {agencies.length > 0 && (
          <button
            onClick={handleExportCsv}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 cursor-pointer inline-flex items-center gap-1"
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Scarica CSV
          </button>
        )}
      </div>
      {agencies.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Nessuna agenzia trovata entro 5 km.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left bg-gray-50/50">
                <th className="px-4 py-2 font-semibold text-gray-500">Nome</th>
                <th className="px-4 py-2 font-semibold text-gray-500">Indirizzo</th>
                <th className="px-4 py-2 font-semibold text-gray-500">Telefono</th>
                <th className="px-4 py-2 font-semibold text-gray-500">Mappa</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map(a => (
                <tr key={a.osmId} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-2 text-gray-600">{a.address}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {a.phone ? <a href={`tel:${a.phone}`} className="text-rose-600 hover:underline">{a.phone}</a> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    <a href={a.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                      Apri
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )}
</div>
```

**Step 4: Verificare**

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npx tsc --noEmit
npx eslint --no-warn-ignored src/app/admin/inviti/InvitiPageClient.tsx 2>&1 | tail -5
```

Expected: clean.

**Step 5: Smoke test** (preview)

Usa `mcp__Claude_Preview__preview_start` + login come superadmin. Vai in /admin/inviti. Scegli uno sportello (con `address` impostato) e clicca "Cerca a 5 km". Aspetta 5-30 secondi. Verifica che compaia una tabella di agenzie. Verifica anche il download CSV.

**Step 6: Commit**

```bash
git add src/app/admin/inviti/InvitiPageClient.tsx
git commit -m "feat(admin): real estate agency search section in /admin/inviti"
```

---

## Task 7: Build + deploy

**Step 1: Build locale**

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npm run build 2>&1 | tail -20
```

Expected: build completa senza errori. `/admin/inviti` ancora nella lista.

**Step 2: Deploy Netlify**

```bash
npx --yes netlify-cli deploy --prod --dir=.next 2>&1 | tail -15
```

Expected: "Production deploy is live".

**Step 3: Smoke test produzione**

Chiedere all'utente di:
1. Loggarsi come superadmin
2. Verificare che gli sportelli abbiano un `address` impostato (altrimenti la ricerca fallisce)
3. Andare in `/admin/inviti` → sezione "Trova agenzie immobiliari" → scegliere sportello → "Cerca a 5 km" (può durare 10-30s)
4. Verificare i risultati e provare a scaricare il CSV
5. Verificare che le agenzie senza telefono siano visualizzate con "—"

**Step 4: Push (se PAT funzionante)**

```bash
git push origin main
```

---

## Checklist finale

- [ ] Task 1: migration `agents.lat`/`lng`
- [ ] Task 2: tipi TS (`Agent`, `AgencyResult`)
- [ ] Task 3: modulo Nominatim (`src/lib/geocode.ts`)
- [ ] Task 4: modulo Overpass (`src/lib/overpass.ts`)
- [ ] Task 5: server action `searchNearbyAgencies`
- [ ] Task 6: sezione UI in /admin/inviti
- [ ] Task 7: build + deploy + smoke
