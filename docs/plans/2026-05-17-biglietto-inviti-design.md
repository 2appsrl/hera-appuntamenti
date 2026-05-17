# Biglietto invito collaborazione — Design

Data: 2026-05-17

## Obiettivo

Permettere al superadmin di generare in blocco biglietti A6 da
distribuire a agenzie immobiliari e amministratori di condominio.
Ogni biglietto promuove la collaborazione e contiene i dati del
venditore (agente) e dello sportello presso cui conduce i colloqui.

## Requisiti utente

- Genera il superadmin (non gli operatori, non gli agenti).
- Formato A6 portrait (105 × 148 mm).
- Per ogni agente viene scelto al momento della stampa lo sportello
  di riferimento (lista degli sportelli attivi).
- Output: PDF stampabile (4 biglietti per A4 con segni di taglio).
- Pagina dedicata `/admin/inviti`.

## Decisioni di design

### Layout della cartolina

```
┌──────────────────────────────────┐
│  [LOGO HERACOMM]                 │  ← banda bianca alta con logo
├──────────────────────────────────┤
│  Vieni a scoprire come possiamo  │
│  SEMPLIFICARE le pratiche luce   │  ← headline (verde l'accento)
│  e gas dei tuoi clienti.         │
│                                  │
│  • Nuovi allacciamenti e         │
│    subentri                      │
│  • Volture luce e gas            │  ← 4 servizi
│  • Aumenti o diminuzioni potenza │
│  • Risparmio energetico e        │
│    consulenza tariffe            │
│                                  │
│  ┌────────────────────────────┐  │
│  │  COME FUNZIONA             │  │
│  │  ① Segnali  ② Gestiamo     │  │  ← 3-step
│  │     cliente   tutto        │  │
│  │              ③ Ricevi      │  │
│  │                 provvigione│  │
│  └────────────────────────────┘  │
│                                  │
├──────────────────────────────────┤
│  IL TUO CONTATTO     ┌────┐      │
│  Mario Rossi         │ QR │      │  ← footer
│  SPORTELLO           └────┘      │
│  Sportello Centro                │
│  Via Roma 12 — Milano            │
│  Tel. 02 1234 5678               │
└──────────────────────────────────┘
```

Mockup di riferimento: `public/mockup-card-v4.html` (file di sviluppo,
non da committare in produzione).

### Contenuti fissi

- Headline: "Vieni a scoprire come possiamo **semplificare** le
  pratiche luce e gas dei tuoi clienti."
- 4 servizi (lista sopra)
- 3 step "Come funziona":
  1. Segnali il cliente — basta una telefonata
  2. Gestiamo tutto — burocrazia inclusa
  3. Ricevi la provvigione — a contratto chiuso

### Contenuti dinamici

| Campo               | Origine                                       |
| ------------------- | --------------------------------------------- |
| Nome venditore      | `agents.name` dell'agente selezionato         |
| Nome sportello      | `agents.name` dello sportello (tipo=sportello)|
| Indirizzo sportello | `agents.address`                              |
| Telefono sportello  | nuovo campo `agents.phone`                    |
| QR code             | URL Google Maps con indirizzo sportello       |

### Schema database

Aggiungo una colonna nullable a `agents`:

```sql
ALTER TABLE agents
  ADD COLUMN phone TEXT;
```

Il superadmin lo imposta dalla pagina Gestione, per ognuno degli
sportelli (gli agenti non hanno bisogno del telefono qui).

Nessun campo aggiuntivo per il legame agente↔sportello: viene scelto
al momento della stampa dalla pagina `/admin/inviti`.

### Pagina `/admin/inviti`

- Lista degli agenti `type='agente'` attivi
- Per ogni riga: nome agente + dropdown "Sportello di riferimento"
  con tutti gli sportelli attivi
- Pulsante "Anteprima" → mostra il biglietto come HTML (singolo)
- Pulsante "Genera PDF" → produce un PDF con tutti i biglietti scelti
- Default: nessuno selezionato

### Generazione PDF

**Opzione scelta:** rendering server-side con pdf-lib (già nelle
dipendenze del progetto) + composizione manuale degli elementi
(testi, rettangoli, immagini per logo e QR).

**Scartata:** rendering client-side via `window.print()` su un
documento HTML/CSS — più semplice ma:
- L'output dipende dalle impostazioni di stampa del browser.
- Difficile garantire allineamento preciso A6 e crocini di taglio.
- Embed dei font customizzati problematico.

**QR code:** generato server-side con la libreria `qrcode` (npm,
~2 KB minified). Output PNG inline (data URL) o stream bytes.

**Layout pagina A4 (impaginazione 4-up):**
```
┌──────────┬──────────┐
│  Card 1  │  Card 2  │
├──────────┼──────────┤
│  Card 3  │  Card 4  │
└──────────┴──────────┘
```
Con linee di taglio sottili agli incroci.

### Logo HeraComm

Per il design e i mockup uso un placeholder esplicito. Per la
produzione l'utente deve fornire il file vettoriale ufficiale (SVG
o PDF) — il logo è marchio registrato di HeraComm S.r.l. e non può
essere ricreato o scaricato da fonti terze senza certezza dei
diritti d'uso. Una volta fornito, viene salvato in
`public/assets/heracomm-logo.svg` e embeddato nel PDF tramite
pdf-lib.

## Scope

**In scope**
- Migration: campo `agents.phone`
- Aggiornamento pagina Gestione per editare il telefono degli
  sportelli
- Nuova pagina `/admin/inviti` (lista + selezione sportello +
  generazione PDF)
- Endpoint server-side che genera il PDF (pdf-lib + qrcode)
- Linea di stato "ancora nessun logo caricato" se il file SVG
  ufficiale non è presente — il PDF parte comunque con un
  placeholder

**Fuori scope (per richieste future)**
- Personalizzazione del telefono venditore (rimasto fuori per
  decisione esplicita)
- Editing/scelta di template alternativi
- Tracking di quante volte un biglietto è stato consegnato
- Versione fronte/retro
- Stampa diretta da app (sempre via download PDF)
- Salvataggio storico dei PDF generati

## Rischi

- **Asset logo**: finché HeraComm non fornisce il file vettoriale,
  il PDF di produzione esce con un placeholder. Documentato sopra,
  la pagina mostrerà l'avviso.
- **Layout PDF**: pdf-lib non ha un sistema di flowing layout —
  ogni elemento va posizionato manualmente con coordinate. La
  prima implementazione richiede tuning empirico.
- **QR code → Google Maps**: usa una URL del tipo
  `https://www.google.com/maps/search/?api=1&query=<address>`.
  Se l'indirizzo nell'`agents.address` è ambiguo o sbagliato, il
  QR porta a un risultato errato. Mitigato dal fatto che
  l'indirizzo è inserito a mano dal superadmin in Gestione.

## File coinvolti

- `supabase/schema.sql` — documenta il nuovo campo
- Nuova migration via MCP Supabase (`agents.phone`)
- `src/app/admin/gestione/AgentManager.tsx` — campo telefono
  editabile per gli sportelli
- `src/app/admin/inviti/page.tsx` — nuova pagina
- `src/app/admin/inviti/InvitiPageClient.tsx` — UI client
- `src/app/admin/inviti/actions.ts` — server action che genera PDF
- `src/app/admin/inviti/generateCardPdf.ts` — composizione pdf-lib
- `src/lib/types.ts` — tipo `Agent` esteso con `phone`
- `package.json` — dipendenza `qrcode`
