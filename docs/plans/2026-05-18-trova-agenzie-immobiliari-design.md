# Trova agenzie immobiliari nei dintorni degli sportelli — Design

Data: 2026-05-18

## Obiettivo

Permettere al superadmin di trovare, dalla pagina `/admin/inviti`, le
agenzie immobiliari nel raggio di 5 km da uno sportello, con nome,
indirizzo e (se disponibile) telefono. La lista serve per pianificare
visite di persona durante le quali si consegna il biglietto invito.

## Requisiti utente

- Sorgente dati gratuita, legittima (no scraping Google Maps).
- Si parte dallo sportello e si cerca entro 5 km.
- Output: lista visualizzabile + esportabile in CSV.
- Niente persistenza per ora: ogni ricerca è on-demand.
- Telefono accettabilmente parziale (~50% delle agenzie su OSM in
  Italia non ha il campo telefono — è ok).

## Decisioni architetturali

### Sorgente dati: OpenStreetMap

- **Overpass API** (`https://overpass-api.de/api/interpreter`) per la
  ricerca delle agenzie. Tag standard: `office=estate_agent` oppure
  `shop=real_estate`.
- **Nominatim** (`https://nominatim.openstreetmap.org/search`) per
  geocodificare l'indirizzo dello sportello in lat/lng.
- Entrambi gratuiti, comunità OSM. Rispettiamo le policy:
  - User-Agent identificativo
  - Max 1 richiesta/sec a Nominatim
  - Overpass: `timeout:25` nella query, no batch paralleli

### Geocodifica lazy

Aggiungo due colonne nullable a `agents`:

```sql
ALTER TABLE agents
  ADD COLUMN lat DOUBLE PRECISION,
  ADD COLUMN lng DOUBLE PRECISION;
```

Quando il superadmin clicca "Cerca" su uno sportello che ha
`lat/lng IS NULL`, l'app chiama Nominatim con l'indirizzo, salva il
risultato, poi procede con Overpass. Le ricerche successive sullo
stesso sportello partono dirette.

Razionale: niente lavoro extra in fase di salvataggio Gestione,
niente modifiche all'UI Gestione. Il costo della geocodifica è
pagato una volta sola al primo uso.

### Query Overpass

```overpass
[out:json][timeout:25];
(
  node["office"="estate_agent"](around:5000, <lat>, <lng>);
  node["shop"="real_estate"](around:5000, <lat>, <lng>);
);
out body 200;
```

Limite 200 risultati per evitare abuso. In Italia 5 km tipicamente
restituisce 20-50 risultati, quindi non è restrittivo.

### Estrazione campi dal risultato Overpass

Per ogni node:

- **Nome**: `tags.name` (fallback: "Senza nome")
- **Indirizzo**: composizione di `addr:street + addr:housenumber, addr:city` —
  se mancano singoli campi, mostra solo quelli presenti; se mancano tutti,
  mostra "Indirizzo non specificato"
- **Telefono**: prima `tags["contact:phone"]`, poi `tags.phone`, altrimenti `null`
- **Lat/Lng**: dall'oggetto node stesso (per il link Google Maps)
- **OSM ID**: salvato come chiave di dedup nel CSV (utile futuro)

### UI

Nuova sezione in cima a `/admin/inviti`, sopra la tabella esistente
dei biglietti:

```
┌──────────────────────────────────────────────┐
│  Trova agenzie immobiliari                   │
│  ─────────────────────────────────────       │
│  Sportello: [dropdown] [Cerca a 5 km]        │
│                                              │
│  (loader / errore / tabella risultati)       │
│                                              │
│  N agenzie trovate                           │
│  ┌──────────────────────────────────────┐   │
│  │ Nome | Indirizzo | Telefono | Mappa │   │
│  ├──────────────────────────────────────┤   │
│  │ ...                                  │   │
│  └──────────────────────────────────────┘   │
│  [ Scarica CSV ]                             │
└──────────────────────────────────────────────┘
```

- Dropdown popolato con gli sportelli attivi.
- Bottone "Cerca a 5 km" disabilitato se non c'è uno sportello scelto
  o se è in corso una ricerca.
- Spinner inline durante la chiamata server (può durare 5-30 s).
- "Scarica CSV" appare solo se ci sono risultati.

### Server action

`searchNearbyAgencies(sportelloId: string)` in
`src/app/admin/inviti/searchAgencies.ts`:

1. Verifica auth superadmin.
2. Carica lo sportello.
3. Se `lat/lng` mancanti:
   - Costruisce la query a Nominatim con `address`.
   - Salva lat/lng in DB.
4. Costruisce e invia query Overpass.
5. Parse + mappa al formato `AgencyResult`.
6. Restituisce `{ agencies: AgencyResult[] }` oppure `{ error: string }`.

```ts
export interface AgencyResult {
  osmId: string
  name: string
  address: string
  phone: string | null
  lat: number
  lng: number
  mapsUrl: string  // https://www.google.com/maps/search/?api=1&query=<lat>,<lng>
}
```

### CSV export

Client-side: prende l'array `AgencyResult[]`, genera un CSV con
header `Nome,Indirizzo,Telefono,Lat,Lng,Mappa`, scarica come file
`agenzie-<sportello>-<data>.csv`. Niente server per questo step.

## Scope

**In scope**
- Migration: colonne `agents.lat`, `agents.lng`
- Modulo geocodifica Nominatim (`src/lib/geocode.ts`)
- Modulo query Overpass (`src/lib/overpass.ts`)
- Server action `searchNearbyAgencies`
- Sezione "Trova agenzie immobiliari" in `/admin/inviti`
- Esportazione CSV client-side

**Fuori scope (per richieste future)**
- Salvataggio risultati in DB / tracking visita
- Raggio variabile
- Filtri per provincia o regione
- Integrazione con stampa biglietti (es. "stampa N copie per queste agenzie")
- Edit manuale di lat/lng dalla Gestione (se la geocodifica fallisce
  ripetutamente, possiamo aggiungerlo dopo)

## Rischi

- **Copertura telefoni**: stimata 30-50% in Italia. Atteso e
  accettato dall'utente.
- **Rate limiting Nominatim** (1 req/sec, max 1 utente/IP): per pochi
  sportelli (~10) non è un problema. Se in futuro lo diventa, possiamo
  fare batch nightly o passare a Photon (alternativa).
- **Overpass timeout**: 5 km è leggero, ma se l'endpoint pubblico è
  sotto carico la richiesta può fallire. Gestita con messaggio di errore
  + retry manuale dell'utente.
- **Sportello senza `address`**: bloccante. Mostriamo errore e
  rimandiamo a Gestione per impostarlo.
- **Geocodifica imprecisa**: Nominatim potrebbe localizzare male un
  indirizzo (es. via troppo generica). L'app non valida — l'admin
  vede risultati strani e capisce di rivedere l'indirizzo.

## File coinvolti

- `supabase/schema.sql` (documentazione)
- Migration via MCP Supabase
- `src/lib/geocode.ts` (nuovo)
- `src/lib/overpass.ts` (nuovo)
- `src/app/admin/inviti/searchAgencies.ts` (nuovo)
- `src/app/admin/inviti/page.tsx` (estendere per passare gli sportelli)
- `src/app/admin/inviti/InvitiPageClient.tsx` (nuova sezione UI)
- `src/lib/types.ts` (`Agent.lat/lng`, `AgencyResult`)
