// Italian timezone helpers. The DB stores `created_at` as TIMESTAMPTZ (UTC),
// but the app's working day is the Italian calendar day (CET/CEST).
// Filtering by `${today}T00:00:00` without an explicit offset makes Postgres
// treat the bound as UTC, which drops outcomes recorded in the first ~2 hours
// of the Italian day (when UTC is still "yesterday").

const ROME_TZ = 'Europe/Rome'

export function getRomeToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ROME_TZ })
}

export function getRomeFirstOfMonth(): string {
  return getRomeToday().slice(0, 8) + '01'
}

function getRomeOffset(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ROME_TZ,
    timeZoneName: 'longOffset',
  }).formatToParts(at)
  const raw = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+01:00'
  return raw.replace('GMT', '') || '+01:00'
}

export function romeDayUTCRange(romeDate: string): { fromUTC: string; toUTC: string } {
  const probe = new Date(`${romeDate}T12:00:00Z`)
  const offset = getRomeOffset(probe)
  return {
    fromUTC: new Date(`${romeDate}T00:00:00${offset}`).toISOString(),
    toUTC: new Date(`${romeDate}T23:59:59.999${offset}`).toISOString(),
  }
}

export function romeRangeUTC(fromRomeDate: string, toRomeDate: string): { fromUTC: string; toUTC: string } {
  return {
    fromUTC: romeDayUTCRange(fromRomeDate).fromUTC,
    toUTC: romeDayUTCRange(toRomeDate).toUTC,
  }
}

export function utcToRomeDate(utcIso: string): string {
  return new Date(utcIso).toLocaleDateString('en-CA', { timeZone: ROME_TZ })
}

export function utcToRomeHour(utcIso: string): number {
  const hh = new Intl.DateTimeFormat('en-US', {
    timeZone: ROME_TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(utcIso))
  return parseInt(hh, 10)
}
