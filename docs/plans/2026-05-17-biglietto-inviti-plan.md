# Biglietto invito collaborazione — Piano di implementazione

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permettere al superadmin di generare un PDF con biglietti A6 da consegnare a agenzie immobiliari e amministratori di condominio, scegliendo lo sportello di riferimento di ogni agente.

**Architecture:** Server action Next.js che usa `pdf-lib` (già nelle dipendenze) per comporre un PDF A4 con 4 biglietti A6 + crocini di taglio. QR code generato server-side con la libreria `qrcode`. Nuova pagina admin `/admin/inviti` con tabella agenti × dropdown sportello + bottoni "Anteprima" e "Genera PDF". Aggiunto campo `agents.phone` editato dalla pagina Gestione esistente.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres, TypeScript, Tailwind, `pdf-lib` (esistente), `qrcode` (nuova dipendenza).

**Verifica:** progetto senza test runner. Ogni task si verifica con:
- `npx tsc --noEmit` (no errori nuovi)
- `npx eslint <files>` (no errori nuovi)
- Per PDF: scaricare il file generato e aprirlo visivamente
- Per UI: preview via `mcp__Claude_Preview__preview_start`

Design di riferimento: `docs/plans/2026-05-17-biglietto-inviti-design.md`. Mockup HTML: `public/mockup-card-v4.html`.

Riferimento skill: @superpowers:verification-before-completion.

---

## Task 1: Migration database — campo `agents.phone`

**Files:**
- Modify: `supabase/schema.sql` (documentazione)

**Step 1: Applicare la migration via MCP Supabase**

Project id: `ihttvrfhbcznynqhobrm`
Tool: `mcp__42edcf0e-514f-4173-b1a8-a59c2bb92d01__apply_migration`
Name: `add_phone_to_agents`
Query:

```sql
ALTER TABLE agents ADD COLUMN phone TEXT;
```

**Step 2: Verificare**

Tool: `mcp__42edcf0e-514f-4173-b1a8-a59c2bb92d01__execute_sql`

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name='agents' AND column_name='phone';
```

Expected: 1 riga, `data_type='text'`, `is_nullable='YES'`.

**Step 3: Aggiornare `supabase/schema.sql`**

Nella definizione della tabella `agents` (riga ~14), aggiungere il campo `phone TEXT` subito dopo `address TEXT`.

**Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): add phone column to agents"
```

---

## Task 2: Tipo TypeScript `Agent.phone`

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Estendere l'interfaccia `Agent`**

Aggiungere `phone: string | null` subito dopo `address: string | null`:

```ts
export interface Agent {
  id: string
  name: string
  type: AgentType
  active: boolean
  address: string | null
  phone: string | null
  user_id: string | null
  created_at: string
}
```

**Step 2: Verificare**

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npx tsc --noEmit
```

Expected: nessun errore (il campo è optional in senso DB e non viene letto da nessuno ancora).

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add phone field to Agent interface"
```

---

## Task 3: Editing telefono in Gestione

**Files:**
- Modify: `src/app/admin/gestione/AgentManager.tsx`
- Modify: `src/app/admin/gestione/actions.ts` (estendere `updateAgent` / o l'azione esistente per accettare `phone`)

**Step 1: Esaminare le funzioni esistenti**

Leggere `src/app/admin/gestione/actions.ts` per capire come oggi si edita un agente (probabilmente c'è `updateAgent({ id, name, ... })`). Aggiungere `phone?: string | null` ai parametri e all'UPDATE.

**Step 2: UI**

In `AgentManager.tsx`, dove si edita un agente di tipo `sportello`, aggiungere un input "Telefono" subito dopo l'indirizzo. Il campo è visibile solo per `type === 'sportello'` (per gli agenti non serve).

Validazione minima: trim → null se vuoto. Nessun pattern (i numeri di sportello variano, possono avere prefissi internazionali, spazi, ecc.).

**Step 3: Wiring**

Salvare il valore in DB tramite l'azione aggiornata. Aggiornare lo state locale dopo il save.

**Step 4: Verificare**

```bash
npx tsc --noEmit 2>&1 | head -10
npx eslint --no-warn-ignored src/app/admin/gestione/AgentManager.tsx src/app/admin/gestione/actions.ts 2>&1 | tail -10
```

Expected: clean.

Smoke test via `mcp__Claude_Preview__preview_start` (nuovo dev server): login come superadmin → Gestione → editare uno sportello → impostare telefono → verifica via `mcp__42edcf0e-514f-4173-b1a8-a59c2bb92d01__execute_sql`:

```sql
SELECT id, name, phone FROM agents WHERE type='sportello' ORDER BY name LIMIT 5;
```

**Step 5: Commit**

```bash
git add src/app/admin/gestione/AgentManager.tsx src/app/admin/gestione/actions.ts
git commit -m "feat(gestione): add phone field for sportelli"
```

---

## Task 4: Installare la dipendenza `qrcode`

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (se esiste)

**Step 1: Installare**

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npm install qrcode && npm install --save-dev @types/qrcode
```

**Step 2: Verificare**

```bash
node -e "console.log(typeof require('qrcode').toBuffer)"
```

Expected: `function`.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add qrcode and @types/qrcode"
```

---

## Task 5: Modulo PDF — disegno singolo biglietto

**Files:**
- Create: `src/app/admin/inviti/generateCardPdf.ts`

**Step 1: Scrivere il modulo**

API attesa:

```ts
import { PDFDocument, PDFPage, rgb, StandardFonts, PDFFont } from 'pdf-lib'
import QRCode from 'qrcode'

export interface CardData {
  agentName: string
  sportelloName: string
  sportelloAddress: string
  sportelloPhone: string | null
}

// Misure in punti PDF (72 pt = 1 pollice). A6 portrait = 297.6 × 419.5 pt.
export const CARD_W = 297.6
export const CARD_H = 419.5

/**
 * Disegna un singolo biglietto su `page` a partire dall'angolo (originX, originY).
 * originY è la coordinata Y dell'angolo SUPERIORE-SINISTRO del biglietto (pdf-lib
 * usa Y crescente verso l'alto: convertiamo internamente).
 */
export async function drawCard(
  page: PDFPage,
  origin: { x: number; y: number },
  data: CardData,
  fonts: { regular: PDFFont; bold: PDFFont; black: PDFFont; italic: PDFFont },
) {
  // ... implementazione che disegna:
  // 1. Banda logo placeholder (rettangolo bordato in alto)
  // 2. Headline su 3 righe con "semplificare" in verde
  // 3. 4 servizi con pallini verdi
  // 4. Box "Come funziona" con 3 step numerati
  // 5. Linea separatrice
  // 6. Footer: nome venditore, sportello, indirizzo, telefono
  // 7. QR code (immagine PNG) in basso a destra
}

/**
 * Genera un PDF A4 con fino a 4 biglietti.
 */
export async function generateCardsPdf(cards: CardData[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    black: await doc.embedFont(StandardFonts.HelveticaBold), // pdf-lib non ha black built-in
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  }

  // A4 portrait = 595 × 842 pt
  const PAGE_W = 595, PAGE_H = 842
  const cardsPerPage = 4

  for (let i = 0; i < cards.length; i += cardsPerPage) {
    const page = doc.addPage([PAGE_W, PAGE_H])
    const slice = cards.slice(i, i + cardsPerPage)
    // 2 colonne × 2 righe centrate, margine 0
    for (let j = 0; j < slice.length; j++) {
      const col = j % 2
      const row = Math.floor(j / 2)
      const x = col * CARD_W
      const y = (1 - row) * CARD_H  // riga 0 in alto = y=CARD_H, riga 1 in basso = y=0
      await drawCard(page, { x, y: y + CARD_H }, slice[j], fonts)
    }
    drawCropMarks(page)
  }

  return doc.save()
}

function drawCropMarks(page: PDFPage) {
  // Linee tratteggiate sottili sui 4 incroci centrali per il taglio
  // ...
}
```

Note di implementazione:
- pdf-lib usa coordinate con Y crescente verso l'alto. La funzione `drawCard` accetta l'angolo superiore-sinistro per uniformità con la mentalità HTML.
- pdf-lib non gestisce text wrapping. Implementare manuale: dividere stringhe troppo lunghe in base a `font.widthOfTextAtSize`.
- Il logo HeraComm placeholder: rettangolo con bordo magenta + testo "LOGO HERACOMM" al centro.
- QR code: chiamare `await QRCode.toBuffer(url, { width: 200, margin: 0 })`, poi `await doc.embedPng(buffer)` e disegnarlo a 68 × 68 pt.

**Step 2: Verificare compilazione**

```bash
npx tsc --noEmit 2>&1 | grep "generateCardPdf" || echo "no errors"
```

Expected: nessun errore.

**Step 3: Smoke test diretto del modulo**

Creare uno script temporaneo `/tmp/test-pdf.mjs`:

```js
import { generateCardsPdf } from './src/app/admin/inviti/generateCardPdf.ts'
import fs from 'fs'
const bytes = await generateCardsPdf([
  { agentName: 'Mario Rossi', sportelloName: 'Sportello Centro',
    sportelloAddress: 'Via Roma 12, Milano', sportelloPhone: '02 1234 5678' },
])
fs.writeFileSync('/tmp/test-card.pdf', bytes)
console.log('written:', bytes.byteLength, 'bytes')
```

In realtà ts-node non è installato — basta verificare la compilazione con tsc. Lo smoke test reale avverrà nel Task 8 quando l'endpoint server è in piedi.

**Step 4: Commit**

```bash
git add src/app/admin/inviti/generateCardPdf.ts
git commit -m "feat(pdf): card layout module for invite cards"
```

---

## Task 6: Server action `generateInvitiPdf`

**Files:**
- Create: `src/app/admin/inviti/actions.ts`

**Step 1: Scrivere l'action**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCardsPdf, type CardData } from './generateCardPdf'

export interface InviteRequest {
  agentId: string
  sportelloId: string
}

export async function generateInvitiPdf(requests: InviteRequest[]): Promise<{
  pdfBase64: string
} | { error: string }> {
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

  const { data: agents } = await admin
    .from('agents')
    .select('id, name, type, address, phone')
    .in('id', allIds)

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
```

**Step 2: Verificare**

```bash
npx tsc --noEmit
npx eslint --no-warn-ignored src/app/admin/inviti/actions.ts
```

Expected: clean.

**Step 3: Commit**

```bash
git add src/app/admin/inviti/actions.ts
git commit -m "feat(api): server action to generate invite PDF"
```

---

## Task 7: Pagina `/admin/inviti` — server component + client UI

**Files:**
- Create: `src/app/admin/inviti/page.tsx`
- Create: `src/app/admin/inviti/InvitiPageClient.tsx`

**Step 1: `page.tsx`**

Server component che:
- Verifica auth superadmin (redirect se no)
- Carica lista degli agenti `type='agente'` attivi
- Carica lista degli sportelli `type='sportello'` attivi
- Renderizza il client component passando entrambi

Pattern di riferimento: `src/app/admin/kpi/page.tsx`.

**Step 2: `InvitiPageClient.tsx`**

UI:
- Header con titolo "Biglietti invito" + sottotitolo
- Bottone "Seleziona tutti" / "Deseleziona tutti"
- Tabella con righe per ogni agente:
  - Checkbox di selezione
  - Nome agente
  - Dropdown sportello (default: il primo sportello attivo oppure vuoto)
  - Bottone "Anteprima" (apre nuova tab `/admin/inviti/anteprima?agent=X&sportello=Y` — vedi Task 8 opzionale, oppure rimossa in YAGNI)
- Bottone azione principale "Genera PDF" che:
  - Raccoglie i record selezionati
  - Chiama `generateInvitiPdf`
  - Riceve base64
  - Crea Blob → object URL → click su `<a download>` per scaricare
  - Mostra spinner durante l'operazione

```tsx
// Pseudocodice della handle:
async function handleGenerate() {
  const selected = rows.filter(r => r.checked && r.sportelloId)
  const result = await generateInvitiPdf(
    selected.map(r => ({ agentId: r.agent.id, sportelloId: r.sportelloId }))
  )
  if ('error' in result) { setError(result.error); return }
  const bytes = Uint8Array.from(atob(result.pdfBase64), c => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inviti-${new Date().toISOString().split('T')[0]}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

Stile coerente con le altre pagine admin: `bg-white rounded-2xl shadow-sm border border-gray-100`.

**Step 3: Header navigation**

Verificare che la voce "Inviti" appaia nell'`Header.tsx` per il superadmin. Aggiungerla se manca, accanto a "KPI".

File: `src/components/Header.tsx`.

**Step 4: Verificare**

```bash
npx tsc --noEmit 2>&1 | head -10
npx eslint --no-warn-ignored src/app/admin/inviti/page.tsx src/app/admin/inviti/InvitiPageClient.tsx src/components/Header.tsx 2>&1 | tail -10
```

Expected: clean.

**Step 5: Smoke test**

Avvia `mcp__Claude_Preview__preview_start` (next-dev). Vai su `/admin/inviti`. Verifica:
- La lista mostra tutti gli agenti attivi
- Seleziona uno o più → scegli sportello → "Genera PDF" → download del PDF
- Apri il PDF (chiedi all'utente di verificare visivamente)

**Step 6: Commit**

```bash
git add src/app/admin/inviti/page.tsx src/app/admin/inviti/InvitiPageClient.tsx src/components/Header.tsx
git commit -m "feat(admin): /admin/inviti page for generating invite PDFs"
```

---

## Task 8: Build + deploy

**Step 1: Build locale**

```bash
cd "/Users/semronzoni/Desktop/1RangerDea/Claude/Hera Appuntamenti" && npm run build 2>&1 | tail -20
```

Expected: "Compiled successfully" + il route `/admin/inviti` appare nella lista.

**Step 2: Deploy**

```bash
npx --yes netlify-cli deploy --build --prod 2>&1 | tail -15
```

Expected: "Production deploy is live".

**Step 3: Smoke test produzione**

Chiedere all'utente di:
1. Loggarsi come superadmin
2. Andare in `/admin/gestione` → impostare un telefono su uno sportello
3. Andare in `/admin/inviti` → selezionare 1-2 agenti con quello sportello → "Genera PDF"
4. Aprire il PDF e verificare: layout A6, contenuti corretti, QR funzionante (provare a scansionarlo con lo smartphone → deve aprire Google Maps con l'indirizzo dello sportello)

**Step 4: Push (se PAT funzionante)**

```bash
git push origin main
```

---

## Checklist finale

- [ ] Task 1: migration `agents.phone`
- [ ] Task 2: tipo TS `Agent.phone`
- [ ] Task 3: telefono editabile in Gestione
- [ ] Task 4: dipendenza `qrcode`
- [ ] Task 5: modulo PDF
- [ ] Task 6: server action
- [ ] Task 7: pagina `/admin/inviti` + voce header
- [ ] Task 8: build + deploy + smoke test
