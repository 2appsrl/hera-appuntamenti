import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()

  // Test 1: Simple count
  const { count, error: countError } = await admin
    .from('appointments')
    .select('*', { count: 'exact', head: true })

  // Test 2: All appointments without joins
  const { data: plain, error: plainError } = await admin
    .from('appointments')
    .select('id, client_name, appointment_date')
    .order('appointment_date', { ascending: false })

  // Test 3: With joins
  const { data: joined, error: joinError } = await admin
    .from('appointments')
    .select('id, client_name, appointment_date, agents(name), users(name), appointment_outcomes(*)')
    .order('appointment_date', { ascending: false })

  // Test 4: Just appointment_outcomes
  const { data: outcomes, error: outcomesError } = await admin
    .from('appointment_outcomes')
    .select('*')

  return NextResponse.json({
    count,
    countError,
    plain: plain?.length,
    plainData: plain,
    plainError,
    joined: joined?.length,
    joinedData: joined,
    joinError,
    outcomes,
    outcomesError,
  })
}
