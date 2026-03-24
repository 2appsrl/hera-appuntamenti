# Design: Modifica Appuntamenti dalla Dashboard Operatrice

**Data:** 2026-03-24

## Obiettivo

L'operatrice deve poter visualizzare tutti i propri appuntamenti fissati (non solo quelli di oggi), vedere l'esito dato dall'agente, e modificare i dati di un appuntamento. Le modifiche si riflettono automaticamente nelle dashboard di agente e admin.

## Sezione "Appuntamenti Fissati"

### Posizione
Sostituisce la sezione "Appuntamenti di oggi" nella dashboard operatrice.

### Tab
- **Prossimi**: appuntamenti con `appointment_date >= oggi`, ordinati dal più vicino
- **Passati**: appuntamenti con `appointment_date < oggi`, ordinati dal più recente

### Filtri (collassabili)
- **Agente**: dropdown con lista agenti
- **Data**: date picker range (da/a)
- **Esito**: dropdown (Tutti / In attesa / Positivo / Negativo / Non presentato)

### Card Appuntamento
Ogni card mostra:
- Ora e Data
- Cliente (nome + cognome) e telefono
- Agente assegnato
- Luogo
- Badge esito (se compilato dall'agente): verde (positivo), rosso (negativo), grigio (non presentato)
- Icona modifica (matita) per aprire il modal di edit

## Modifica Appuntamento

### Approccio
Riuso del componente `AppointmentModal` in modalità edit:
- Si apre precompilato con i dati attuali
- Campi modificabili: nome, cognome, telefono, agente, data, ora, luogo, note
- Validazione: stesse regole della creazione (disponibilità agente, campi obbligatori)

### Server Action
Nuova action `updateAppointment(id, formData)` in `src/app/operatore/actions.ts`:
- Verifica che l'appuntamento appartenga all'operatrice (user_id)
- Aggiorna il record nella tabella `appointments` su Supabase
- Revalidate del path per aggiornare la UI

### Sincronizzazione
Poiché tutti i dashboard leggono dalla stessa tabella `appointments` su Supabase, qualsiasi modifica è automaticamente visibile a:
- **Agente**: nella sua vista settimanale
- **Admin**: nella tabella appuntamenti e nelle statistiche

## File coinvolti
- `src/app/operatore/OperatorPageClient.tsx` — nuova sezione con tab e filtri
- `src/app/operatore/actions.ts` — nuova action `updateAppointment` + query per tutti gli appuntamenti
- `src/app/operatore/page.tsx` — passaggio dati appuntamenti al client
- `src/components/AppointmentModal.tsx` — aggiunta modalità edit (prop `editData`)
