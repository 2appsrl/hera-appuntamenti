import type { Config } from "@netlify/functions"

export default async () => {
  const siteUrl = process.env.URL || 'https://hera-appuntamenti.netlify.app'
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('CRON_SECRET not set')
    return new Response('CRON_SECRET not configured', { status: 500 })
  }

  try {
    const res = await fetch(`${siteUrl}/api/send-daily-agenda?key=${cronSecret}`)
    const data = await res.json()

    if (!res.ok) {
      console.error('Email send failed:', data)
      return new Response(JSON.stringify(data), { status: res.status })
    }

    console.log('Daily agenda sent:', data)
    return new Response(JSON.stringify(data), { status: 200 })
  } catch (err) {
    console.error('Scheduled function error:', err)
    return new Response('Error', { status: 500 })
  }
}

// Run at 18:05 every day (Italy is UTC+1/+2, so 16:05 or 17:05 UTC)
// Using 16:05 UTC = 18:05 CEST (summer) / 17:05 CET (winter)
// Adjust if needed for daylight saving
export const config: Config = {
  schedule: "5 16 * * *"
}
