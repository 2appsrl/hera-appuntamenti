# KPI Dashboard Design

## Purpose

Admin page to track campaign KPIs required by Hera:
- 15% of assigned nominativi must be called (esitati su Salesforce)
- 3.5% of the call target must result in positive contracts (esito positivo appuntamenti)

All metrics are monthly and filterable by operator.

## Data Model

### New table: `campaign_entries`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid FK → users | operator |
| month | text | "2026-04" format |
| count | integer | nominativi added (e.g. +200) |
| note | text nullable | optional label |
| created_at | timestamptz | default now() |

Multiple entries per operator/month allowed — total = SUM(count).

### RLS

- Superadmin: full CRUD
- Others: no access

## KPI Calculations

```
nominativi        = SUM(campaign_entries.count) for operator/month
target_chiamate   = CEIL(nominativi * 0.15)
chiamate_fatte    = COUNT(call_outcomes) for operator/month
target_contratti  = CEIL(target_chiamate * 0.035)
contratti_chiusi  = COUNT(appointment_outcomes WHERE outcome='positivo') for operator/month
```

## Page Layout: `/admin/kpi`

### Filters (top bar)
- Month selector: dropdown, default current month, last 12 months
- Operator selector: dropdown, default "Tutte"

### Summary Cards (3 large cards)
1. **Nominativi Campagna** — total count, with "Modifica" button
2. **Chiamate Salesforce** — progress bar: `chiamate_fatte / target_chiamate` + percentage
3. **Contratti** — progress bar: `contratti_chiusi / target_contratti` + percentage

Progress bar colors: red < 50%, yellow 50-80%, green ≥ 80%.

### Operator Breakdown Table
| Operatrice | Nominativi | Target Chiamate (15%) | Fatte | % | Target Contratti (3.5%) | Chiusi | % | Azioni |
Each row has inline progress indicators. "Azioni" column has "+ Aggiungi" button for nominativi.

### Add Nominativi (inline form)
- Click "+ Aggiungi" on an operator row
- Input: count (number) + note (optional text)
- Submit adds a campaign_entry and recalculates totals
- History of entries visible as tooltip or expandable row

## Navigation
Add "KPI" link in Header.tsx between "Fasce Orarie" and "Esci" for superadmin role.

## Files to Create/Modify

1. `supabase/schema.sql` — add campaign_entries table
2. SQL migration to run on Supabase
3. `src/app/admin/kpi/page.tsx` — server component, data fetching
4. `src/app/admin/kpi/KpiPageClient.tsx` — client component, UI + filters
5. `src/app/admin/kpi/actions.ts` — server actions for campaign_entries CRUD
6. `src/components/Header.tsx` — add KPI nav link
