# Hera Appuntamenti - Design Document

## Obiettivo

Web app per operatrici Heracomm che chiamano clienti per fissare appuntamenti. Le operatrici registrano l'esito di ogni chiamata con un click. Il superadmin vede report, gestisce agenti/sportelli e operatrici.

## Stack Tecnologico

- **Frontend + API:** Next.js (React) deployato su Vercel (gratuito)
- **Database + Auth:** Supabase (PostgreSQL gratuito, 500MB)
- **Grafici:** Recharts
- **Styling:** Tailwind CSS

## Utenti

| Ruolo | Accesso |
|-------|---------|
| Operatore | Pagina con 3 tastoni esiti + form appuntamento + agenda |
| Superadmin | Dashboard report + gestione agenti/sportelli + gestione operatori |

Login con email e password semplice via Supabase Auth.

## Database Schema

### users (profilo custom, collegato a Supabase Auth)
- id (uuid, PK, = auth.users.id)
- email (text)
- name (text)
- role (text: 'operatore' | 'superadmin')
- created_at (timestamp)

### agents (agenti e sportelli)
- id (uuid, PK)
- name (text)
- type (text: 'agente' | 'sportello')
- active (boolean, default true)
- created_at (timestamp)

### agent_availability (disponibilita' settimanale)
- id (uuid, PK)
- agent_id (uuid, FK -> agents)
- day_of_week (integer, 0=lunedi ... 6=domenica)
- start_time (time, es. '09:00')
- end_time (time, es. '13:00')

### call_outcomes (ogni click su un tasto esito)
- id (uuid, PK)
- user_id (uuid, FK -> users)
- outcome (text: 'non_risponde' | 'negativo' | 'appuntamento')
- created_at (timestamp)

### appointments (dati appuntamento, solo per esito = appuntamento)
- id (uuid, PK)
- call_outcome_id (uuid, FK -> call_outcomes)
- user_id (uuid, FK -> users, operatrice che ha fissato)
- agent_id (uuid, FK -> agents)
- client_name (text)
- client_surname (text)
- client_phone (text)
- appointment_date (date)
- appointment_time (time)
- location (text)
- notes (text, opzionale)
- created_at (timestamp)

## UI Design

### Pagina Operatrice (/operatore)

Layout:
- Header con nome operatrice e logout
- Contatore giornaliero: "Non risp: X | Negativi: Y | Appunt: Z"
- 2 tastoni affiancati: "Non risponde/Occupato/Richiamare" (arancione) e "Negativo" (rosso)
- 1 tasto largo sotto: "Appuntamento fissato" (verde, piu' grande)
- Lista appuntamenti fissati oggi dall'operatrice

Flusso "Non risponde" o "Negativo":
1. Click sul tasto
2. Feedback visivo (breve animazione/toast)
3. Contatore aggiornato
4. Torna ai tastoni

Flusso "Appuntamento fissato":
1. Click sul tasto verde
2. Si apre modale con form:
   - Nome, Cognome, Cellulare
   - Agente/Sportello (dropdown, solo quelli attivi)
   - Data (calendario, solo giorni con disponibilita')
   - Ora (slot disponibili per agente+giorno scelto)
   - Luogo
   - Note (opzionale)
3. Salva -> registra call_outcome + appointment
4. Feedback di conferma, contatore aggiornato, appuntamento appare in lista

### Dashboard Superadmin (/admin)

Sezioni:
1. **Filtri**: data da/a, operatrice (dropdown), agente/sportello (dropdown)
2. **Card riassuntive**: totale non risponde, negativi, appuntamenti
3. **Grafico andamento**: linee per giorno (esiti nel tempo)
4. **Grafico distribuzione**: torta con percentuali esiti
5. **Tabella per operatrice**: nome | non risp | neg | app | totale
6. **Lista appuntamenti**: data | cliente | telefono | agente | luogo | note
7. **Export CSV**: esporta dati filtrati
8. **Gestione agenti/sportelli**: CRUD con impostazione disponibilita' settimanale
9. **Gestione operatrici**: CRUD (crea account con email+password+ruolo)

## Disponibilita' Agenti/Sportelli

- Il superadmin imposta fasce orarie settimanali per ogni agente/sportello
- Esempio: Lunedi 9:00-13:00 e 14:00-18:00, Martedi 9:00-12:00
- Quando l'operatrice seleziona un agente nel form appuntamento:
  - Il calendario mostra solo i giorni in cui l'agente e' disponibile
  - Gli slot orari mostrano le fasce disponibili per quel giorno
  - Slot gia' occupati da altri appuntamenti vengono esclusi

## Sicurezza

- Row Level Security (RLS) su Supabase:
  - Operatrici vedono solo i propri dati
  - Superadmin vede tutto
- Autenticazione via Supabase Auth (email + password)
- Middleware Next.js per proteggere le rotte per ruolo
